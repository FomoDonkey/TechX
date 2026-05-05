/**
 * Procesamiento de una submission entrante (POST /api/public/forms/[slug]/submit).
 *
 * Orquesta:
 *  1. Validación con Zod construido dinámicamente
 *  2. Score anti-spam (honeypot, time-trap, heurísticas)
 *  3. Captcha verify (hCaptcha/Turnstile) si está configurado
 *  4. Hash idempotente: si ya existe (formId, hash) → 200 con submission previa
 *  5. Persist
 *  6. Si requiere double-opt-in → genera token y envía email; status pending
 *  7. Si NO → emit webhook form.submitted, dispara automations form_submit,
 *     envía notificaciones y notifySubmitter
 *
 * Diseñado para ser llamado tanto desde un endpoint público REST como desde
 * el preview interno del builder (skipPersist).
 */

import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import { type Form, forms, media, submissions } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { safePublicFetch } from "@/lib/ssrf";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { SPAM_THRESHOLD, scoreSubmission } from "./anti-spam";
import { computeContentHash } from "./lib";
import { buildSubmissionSchema, sanitize } from "./schema-builder";
import {
  defaultConfirmationExpiry,
  signConfirmationToken,
  verifyConfirmationToken,
} from "./tokens";
import {
  DEFAULT_PER_IP_DAILY,
  DEFAULT_PER_IP_HOURLY,
  type FormSchema,
  type FormSettings,
  isInputField,
} from "./types";

export type SubmitInput = {
  form: Form;
  raw: Record<string, unknown>;
  /** Headers/contexto del request. */
  ip: string;
  ipHash: string;
  userAgent?: string;
  referer?: string;
  country?: string;
  origin?: string;
  /** epoch ms enviado por el cliente al cargar el form (csm_t). */
  formLoadedAt?: number;
  /** Token captcha (csm_captcha_token). */
  captchaToken?: string;
  /** UTM detectado vía cookies/url. */
  utm?: Record<string, string>;
};

export type SubmitOutput =
  | { kind: "ok"; submissionId: string; status: "received" | "processed"; needsConfirmation: false }
  | { kind: "ok"; submissionId: string; status: "received"; needsConfirmation: true }
  | { kind: "spam"; submissionId: string }
  | { kind: "duplicate"; submissionId: string }
  | { kind: "validation_error"; issues: z.ZodIssue[] }
  | { kind: "rate_limited"; reason: "hourly" | "daily" }
  | { kind: "captcha_failed" }
  | { kind: "origin_blocked" }
  | { kind: "honeypot_dropped" }
  | { kind: "internal_error"; message: string };

const NOOP_RESULT: SubmitOutput = { kind: "internal_error", message: "DB no disponible" };

export async function processSubmission(input: SubmitInput): Promise<SubmitOutput> {
  if (!db) return NOOP_RESULT;

  const formSchema = (input.form.schema ?? { fields: [], steps: [] }) as FormSchema;
  const settings = (input.form.settings ?? {}) as FormSettings;

  // 0) CORS / origin allowlist
  if (
    settings.allowedOrigins &&
    settings.allowedOrigins.length > 0 &&
    !settings.allowedOrigins.includes("*")
  ) {
    if (!input.origin || !settings.allowedOrigins.includes(input.origin)) {
      return { kind: "origin_blocked" };
    }
  }

  // 1) Honeypot quick-reject (antes de validar nada — barato)
  const honeypotName = settings.honeypotFieldName ?? "csm_company";
  const honeypotValue = input.raw[honeypotName];
  if (
    honeypotValue !== undefined &&
    honeypotValue !== null &&
    honeypotValue !== "" &&
    honeypotValue !== false
  ) {
    return { kind: "honeypot_dropped" };
  }

  // 2) Validación dinámica
  const built = buildSubmissionSchema(formSchema);
  const parsed = built.schema.safeParse(input.raw);
  if (!parsed.success) {
    return { kind: "validation_error", issues: parsed.error.issues };
  }

  // 3) Captcha verify (si configurado)
  if (settings.captcha) {
    const ok = await verifyCaptcha(settings.captcha.provider, input.captchaToken, input.ip);
    if (!ok) return { kind: "captcha_failed" };
  }

  // 4) Score anti-spam
  const score = scoreSubmission({
    honeypotValue,
    formLoadedAt: input.formLoadedAt,
    submittedAt: Date.now(),
    data: parsed.data,
    userAgent: input.userAgent ?? "",
    settings,
  });
  if (score.drop) return { kind: "honeypot_dropped" };

  // 5) Sanitize (descarta keys de campos invisibles + extras técnicas)
  const cleanData = sanitize(formSchema, parsed.data);

  // 6) Files: si hay file fields, normalizar a array de UUIDs.
  // Validamos que cada media pertenezca al mismo workspace para evitar
  // referenciar archivos ajenos (cross-tenant leak).
  const rawAttachments = collectAttachmentIds(formSchema, cleanData);
  const attachmentIds = await filterOwnedMediaIds(input.form.workspaceId, rawAttachments);

  // 7) Hash idempotente
  const hash = computeContentHash(input.form.id, cleanData);

  // 8) Insert con manejo de duplicado vía índice unique (formId, hash)
  const requiresConfirmation = Boolean(settings.doubleOptIn);
  const initialStatus: "received" | "spam" = score.score >= SPAM_THRESHOLD ? "spam" : "received";

  let inserted: typeof submissions.$inferSelect | null = null;
  try {
    const id = crypto.randomUUID();
    const row = (await insertReturning(submissions, {
      id,
      workspaceId: input.form.workspaceId,
      formId: input.form.id,
      formVersion: input.form.version,
      data: cleanData,
      attachments: attachmentIds,
      status: initialStatus,
      spamScore: Math.min(score.score, 100),
      spamReasons: score.reasons.length > 0 ? score.reasons : null,
      contentHash: hash,
      ipHash: settings.storeIp === false ? null : input.ipHash,
      ua: input.userAgent ?? null,
      referer: input.referer ?? null,
      country: input.country ?? null,
      source: input.utm ? { utm: input.utm } : null,
      confirmationToken: null,
    })) as typeof submissions.$inferSelect;
    inserted = row ?? null;
  } catch (err) {
    // Probablemente colisión del unique index (formId, contentHash) → duplicado idempotente
    const message = err instanceof Error ? err.message : String(err);
    if (/duplicate key|unique constraint|submissions_form_hash_idx/i.test(message)) {
      const [existing] = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(and(eq(submissions.formId, input.form.id), eq(submissions.contentHash, hash)))
        .limit(1);
      if (existing) return { kind: "duplicate", submissionId: existing.id };
    }
    return { kind: "internal_error", message: message.slice(0, 200) };
  }

  if (!inserted) return { kind: "internal_error", message: "Insert sin retorno" };

  if (initialStatus === "spam") {
    await db
      .update(forms)
      .set({ spamCount: sql`${forms.spamCount} + 1`, lastSubmissionAt: new Date() })
      .where(eq(forms.id, input.form.id));
    return { kind: "spam", submissionId: inserted.id };
  }

  // 9) Si double opt-in, regeneramos token con sid real y persistimos
  if (requiresConfirmation) {
    const token = signConfirmationToken({
      sid: inserted.id,
      exp: defaultConfirmationExpiry(),
    });
    await db
      .update(submissions)
      .set({ confirmationToken: token })
      .where(eq(submissions.id, inserted.id));
    await sendConfirmationEmailIfPossible({
      form: input.form,
      submission: inserted,
      data: cleanData,
      token,
    });
    await db
      .update(forms)
      .set({ submissionsCount: sql`${forms.submissionsCount} + 1`, lastSubmissionAt: new Date() })
      .where(eq(forms.id, input.form.id));
    return { kind: "ok", submissionId: inserted.id, status: "received", needsConfirmation: true };
  }

  // 10) Path normal: bump counters, notify, webhook, automations
  await db
    .update(forms)
    .set({ submissionsCount: sql`${forms.submissionsCount} + 1`, lastSubmissionAt: new Date() })
    .where(eq(forms.id, input.form.id));

  await onSubmissionConfirmed({
    form: input.form,
    submissionId: inserted.id,
    data: cleanData,
  });

  return { kind: "ok", submissionId: inserted.id, status: "received", needsConfirmation: false };
}

// ============================================================
// Confirmación (double opt-in callback)
// ============================================================

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; reason: "invalid_token" | "expired" | "not_found" | "internal" };

export async function confirmSubmission(token: string): Promise<ConfirmResult> {
  if (!db) return { ok: false, reason: "internal" };
  const payload = verifyConfirmationToken(token);
  if (!payload) return { ok: false, reason: "invalid_token" };

  const [sub] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, payload.sid), eq(submissions.confirmationToken, token)))
    .limit(1);
  if (!sub) return { ok: false, reason: "not_found" };
  if (sub.confirmedAt) return { ok: true, alreadyConfirmed: true };

  const [form] = await db.select().from(forms).where(eq(forms.id, sub.formId)).limit(1);
  if (!form) return { ok: false, reason: "not_found" };

  await db
    .update(submissions)
    .set({ confirmedAt: new Date(), status: "received" })
    .where(eq(submissions.id, sub.id));

  await onSubmissionConfirmed({
    form,
    submissionId: sub.id,
    data: (sub.data ?? {}) as Record<string, unknown>,
  });

  return { ok: true, alreadyConfirmed: false };
}

async function onSubmissionConfirmed(input: {
  form: Form;
  submissionId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  // Webhook genérico
  emitAsync({
    workspaceId: input.form.workspaceId,
    event: "form.submitted",
    payload: {
      formId: input.form.id,
      formSlug: input.form.slug,
      formName: input.form.name,
      submissionId: input.submissionId,
      data: input.data,
    },
  });

  // Notificaciones email a admins
  const emails = input.form.notificationEmails ?? [];
  for (const to of emails) {
    void sendEmail({
      to,
      subject: `[CSM] Nueva entrada en "${input.form.name}"`,
      html: renderNotificationHtml(input.form, input.data),
      text: renderNotificationText(input.form, input.data),
    }).catch((err) => console.error("[forms notify] error:", err));
  }

  // Webhook URL legacy (si configurado)
  if (input.form.webhookUrl) {
    void deliverLegacyWebhook(input.form.webhookUrl, {
      formId: input.form.id,
      submissionId: input.submissionId,
      data: input.data,
    }).catch((err) => console.error("[forms legacy webhook] error:", err));
  }

  // Trigger automations form_submit (lazy import para evitar ciclos)
  try {
    const { triggerFormSubmit } = await import("@/automations/listener");
    await triggerFormSubmit({
      workspaceId: input.form.workspaceId,
      formId: input.form.id,
      submissionId: input.submissionId,
      data: input.data,
    });
  } catch (err) {
    console.error("[forms trigger automations] error:", err);
  }
}

// ============================================================
// Helpers
// ============================================================

function collectAttachmentIds(formSchema: FormSchema, data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const f of formSchema.fields) {
    if (!isInputField(f) || f.type !== "file") continue;
    const v = data[f.key];
    if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) ids.push(v);
    else if (Array.isArray(v))
      for (const x of v) if (typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) ids.push(x);
  }
  return ids;
}

async function verifyCaptcha(
  provider: "hcaptcha" | "turnstile",
  token: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!token) return false;
  // En dev, sin secret configurado, dejamos pasar para no romper el preview.
  // Provider real → POST a su verify endpoint con secret server-side.
  const secretEnv = provider === "hcaptcha" ? "HCAPTCHA_SECRET" : "TURNSTILE_SECRET";
  const secret = process.env[secretEnv];
  if (!secret) {
    console.warn(`[captcha] ${secretEnv} no configurado — aceptando token sin verificar`);
    return true;
  }
  const url =
    provider === "hcaptcha"
      ? "https://api.hcaptcha.com/siteverify"
      : "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}

async function filterOwnedMediaIds(workspaceId: string, ids: string[]): Promise<string[]> {
  if (!db || ids.length === 0) return [];
  // Limitamos a 50 attachments por submission para evitar consultas enormes.
  const capped = ids.slice(0, 50);
  const rows = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.workspaceId, workspaceId), inArray(media.id, capped)));
  const valid = new Set(rows.map((r) => r.id));
  return capped.filter((id) => valid.has(id));
}

async function deliverLegacyWebhook(url: string, payload: unknown): Promise<void> {
  const res = await safePublicFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "CSM-Forms/1.0" },
    body: JSON.stringify(payload),
  });
  await res.text().catch(() => "");
}

async function sendConfirmationEmailIfPossible(input: {
  form: Form;
  submission: typeof submissions.$inferSelect;
  data: Record<string, unknown>;
  token: string;
}): Promise<void> {
  // Detectamos un field email para destinatario.
  const formSchema = (input.form.schema ?? { fields: [], steps: [] }) as FormSchema;
  const emailField = formSchema.fields.find((f) => isInputField(f) && f.type === "email") as
    | { key: string }
    | undefined;
  if (!emailField) return;
  const to = input.data[emailField.key];
  if (typeof to !== "string" || !to.includes("@")) return;

  // Anti-abuse: rate-limit por (formId, hash(email)) para evitar que un
  // atacante inunde la bandeja de una víctima con confirmaciones repetidas.
  // Bucket independiente del IP rate-limit (un atacante puede rotar IP pero
  // el email destino es el mismo).
  const { consume } = await import("@/api/rate-limit");
  const emailKey = `forms:confirm-email:${input.form.id}:${input.form.workspaceId}:${hashEmailKey(to)}`;
  const rl = consume(emailKey, 5, 60 * 60 * 1000); // 5 confirmaciones/h por (form, email)
  if (!rl.ok) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/api/public/forms/${input.form.slug}/confirm?token=${encodeURIComponent(input.token)}`;
  await sendEmail({
    to,
    subject: `Confirma tu envío en "${input.form.name}"`,
    html: `
<!doctype html>
<html><body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#0c0a14;color:#fff;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:linear-gradient(160deg,#1a1228,#0c0a14);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:32px;">
    <div style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#c08bff;margin-bottom:8px;">CSM</div>
    <h1 style="font-size:22px;margin:0 0 12px;">Confirma tu envío ✦</h1>
    <p style="color:#b8b3c7;line-height:1.6;margin:0 0 24px;">
      Pulsa el botón para confirmar tu envío en <strong>${escapeHtml(input.form.name)}</strong>. El enlace caduca en 7 días.
    </p>
    <a href="${link}" style="display:inline-block;background:linear-gradient(120deg,#9b5cff,#ff5db1);color:#fff;text-decoration:none;padding:14px 24px;border-radius:14px;font-weight:600;">Confirmar →</a>
    <p style="color:#736e83;font-size:12px;margin-top:32px;">Si no fuiste tú, ignora este email.</p>
  </div>
</body></html>`,
    text: `Confirma tu envío:\n${link}`,
  }).catch((err) => console.error("[forms confirm email] error:", err));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderNotificationHtml(form: Form, data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#b8b3c7;font-weight:600;">${escapeHtml(k)}</td><td style="padding:6px 12px;color:#fff;">${escapeHtml(String(v ?? ""))}</td></tr>`,
    )
    .join("");
  return `
<!doctype html>
<html><body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#0c0a14;color:#fff;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#1a1228;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:32px;">
    <div style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#c08bff;margin-bottom:8px;">CSM</div>
    <h1 style="font-size:22px;margin:0 0 12px;">Nueva entrada en "${escapeHtml(form.name)}"</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">${rows}</table>
  </div>
</body></html>`;
}

function renderNotificationText(form: Form, data: Record<string, unknown>): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${String(v ?? "")}`);
  return `Nueva entrada en "${form.name}":\n\n${lines.join("\n")}`;
}

export function getDefaultRateLimits(settings: FormSettings | null | undefined) {
  return {
    hourly: settings?.perIpHourly ?? DEFAULT_PER_IP_HOURLY,
    daily: settings?.perIpDaily ?? DEFAULT_PER_IP_DAILY,
  };
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}.csm-form-salt`).digest("hex").slice(0, 32);
}

/** Hash de email normalizado para keys de rate-limit (no reversible, sólo lookup). */
function hashEmailKey(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(`${normalized}.csm-email-rl`).digest("hex").slice(0, 24);
}
