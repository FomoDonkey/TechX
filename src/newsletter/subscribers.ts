/**
 * API server-side de subscribers: alta con doble opt-in, confirmación,
 * actualización de preferencias, baja one-click, import/export bulk, query
 * helpers para segments y campaigns.
 *
 * Reglas de seguridad:
 *  - Toda escritura requiere workspaceId explícito (multi-tenant).
 *  - Email se normaliza a lowercase + trim.
 *  - confirmedAt nunca se setea sin token válido.
 *  - unsubscribeToken se genera en alta (HMAC) y se cachea en la fila para
 *    permitir lookup eficiente en /api/email/click si fuese necesario.
 */

import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { countInt, deleteReturningCount, iLike as ilike, insertReturning } from "@/db/dialect";
import {
  type Subscriber,
  campaignRecipients,
  subscriberConfirmations,
  subscribers,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { tokens } from "./tokens";

export type SubscribePayload = {
  workspaceId: string;
  email: string;
  name?: string | null;
  locale?: string | null;
  source?: string | null;
  tags?: string[] | null;
  /** si true salta el doble opt-in (admin manual import). */
  preConfirmed?: boolean;
};

export type SubscribeResult =
  | { ok: true; subscriber: Subscriber; created: boolean; confirmationToken?: string }
  | { ok: false; error: "invalid_email" | "blocked" | "db_error" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  if (!EMAIL_RE.test(email)) return false;
  if (email.length > 254) return false;
  return true;
}

/**
 * Crea o reactiva un subscriber. Si ya existía y estaba unsubscribed, vuelve
 * a 'active' pero requiere reconfirmación (igual que un signup nuevo). Si
 * estaba 'active' y confirmedAt presente, no requiere confirmación.
 */
export async function subscribe(input: SubscribePayload): Promise<SubscribeResult> {
  if (!db) return { ok: false, error: "db_error" };
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: "invalid_email" };

  // Lookup existente
  const [existing] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.workspaceId, input.workspaceId), eq(subscribers.email, email)))
    .limit(1);

  if (existing) {
    // Si estaba activo + confirmado, sólo actualiza tags/source y devuelve
    if (existing.status === "active" && existing.confirmedAt) {
      const mergedTags = mergeTags(existing.tags, input.tags ?? null);
      const updates: Partial<typeof subscribers.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name && !existing.name) updates.name = input.name;
      if (input.locale && existing.locale !== input.locale) updates.locale = input.locale;
      if (mergedTags) updates.tags = mergedTags;
      await db.update(subscribers).set(updates).where(eq(subscribers.id, existing.id));
      const [updated] = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.id, existing.id))
        .limit(1);
      return { ok: true, subscriber: updated ?? existing, created: false };
    }

    // Reactivación: cambia status, deja confirmedAt nulo (requiere doble opt-in)
    const tagMerge = mergeTags(existing.tags, input.tags ?? null);
    await db
      .update(subscribers)
      .set({
        status: "active",
        unsubscribedAt: null,
        unsubscribeReason: null,
        name: input.name ?? existing.name,
        locale: input.locale ?? existing.locale,
        source: input.source ?? existing.source,
        tags: tagMerge ?? existing.tags,
        confirmedAt: input.preConfirmed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(subscribers.id, existing.id));
    const [reactivated] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, existing.id))
      .limit(1);
    if (!reactivated) return { ok: false, error: "db_error" };

    if (input.preConfirmed) {
      emitAsync({
        workspaceId: input.workspaceId,
        event: "subscriber.confirmed",
        payload: { subscriberId: reactivated.id, email: reactivated.email },
      });
      return { ok: true, subscriber: reactivated, created: false };
    }

    const token = await issueConfirmationToken(input.workspaceId, reactivated.id);
    return { ok: true, subscriber: reactivated, created: false, confirmationToken: token };
  }

  // Inserción nueva. Generamos id pre-INSERT (uuid v4) para poder firmar el
  // unsubscribeToken con el id real desde el inicio — evita la ventana de
  // race donde una request paralela leía la fila con token apuntando a un
  // sid placeholder inexistente.
  const newId = randomUUID();
  const unsubscribeToken = tokens.signUnsub(newId, input.workspaceId);
  const inserted = (await insertReturning(subscribers, {
    id: newId,
    workspaceId: input.workspaceId,
    email,
    name: input.name ?? null,
    locale: input.locale ?? "es",
    source: input.source ?? null,
    tags: input.tags ?? null,
    status: "active",
    confirmedAt: input.preConfirmed ? new Date() : null,
    unsubscribeToken,
  })) as Subscriber;
  if (!inserted) return { ok: false, error: "db_error" };

  emitAsync({
    workspaceId: input.workspaceId,
    event: "subscriber.created",
    payload: { subscriberId: inserted.id, email: inserted.email, source: inserted.source },
  });

  if (input.preConfirmed) {
    emitAsync({
      workspaceId: input.workspaceId,
      event: "subscriber.confirmed",
      payload: { subscriberId: inserted.id, email: inserted.email },
    });
    return {
      ok: true,
      subscriber: inserted,
      created: true,
    };
  }

  const confirmationToken = await issueConfirmationToken(input.workspaceId, inserted.id);
  return {
    ok: true,
    subscriber: inserted,
    created: true,
    confirmationToken,
  };
}

async function issueConfirmationToken(workspaceId: string, subscriberId: string): Promise<string> {
  if (!db) return "";
  const token = tokens.signConfirm(subscriberId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // Invalidamos confirmaciones previas no usadas
  await db
    .update(subscriberConfirmations)
    .set({ expiresAt: new Date(0) })
    .where(
      and(
        eq(subscriberConfirmations.subscriberId, subscriberId),
        isNull(subscriberConfirmations.confirmedAt),
      ),
    );
  await db.insert(subscriberConfirmations).values({
    workspaceId,
    subscriberId,
    token,
    expiresAt,
  });
  return token;
}

export async function confirmSubscription(token: string): Promise<{
  ok: boolean;
  subscriber?: Subscriber;
  reason?: "invalid_token" | "expired" | "already_confirmed" | "db_error";
}> {
  if (!db) return { ok: false, reason: "db_error" };
  const verified = tokens.verifyConfirm(token);
  if (!verified) return { ok: false, reason: "invalid_token" };

  const [conf] = await db
    .select()
    .from(subscriberConfirmations)
    .where(eq(subscriberConfirmations.token, token))
    .limit(1);
  if (!conf) return { ok: false, reason: "invalid_token" };
  if (conf.confirmedAt) {
    const [sub] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.id, conf.subscriberId))
      .limit(1);
    return { ok: true, subscriber: sub, reason: "already_confirmed" };
  }
  if (conf.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const now = new Date();
  await db
    .update(subscriberConfirmations)
    .set({ confirmedAt: now })
    .where(eq(subscriberConfirmations.id, conf.id));

  await db
    .update(subscribers)
    .set({ confirmedAt: now, status: "active", updatedAt: now })
    .where(eq(subscribers.id, conf.subscriberId));
  const [sub] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.id, conf.subscriberId))
    .limit(1);
  if (!sub) return { ok: false, reason: "db_error" };

  emitAsync({
    workspaceId: sub.workspaceId,
    event: "subscriber.confirmed",
    payload: { subscriberId: sub.id, email: sub.email },
  });

  // Enroll en drips trigger=subscribe_confirmed (lazy import para evitar ciclo)
  void (async () => {
    try {
      const { autoEnrollOnConfirm } = await import("./drip");
      await autoEnrollOnConfirm(sub);
    } catch (err) {
      console.error("[newsletter] autoEnroll failed:", err);
    }
  })();

  return { ok: true, subscriber: sub };
}

export async function unsubscribe(input: {
  token?: string;
  subscriberId?: string;
  workspaceId?: string;
  reason?: string;
}): Promise<{ ok: boolean; subscriber?: Subscriber; error?: string }> {
  if (!db) return { ok: false, error: "db_error" };

  let sid: string | null = null;
  let wsId: string | null = null;
  if (input.token) {
    const v = tokens.verifyUnsub(input.token);
    if (!v) return { ok: false, error: "invalid_token" };
    sid = v.sid;
    wsId = v.ws;
  } else if (input.subscriberId && input.workspaceId) {
    sid = input.subscriberId;
    wsId = input.workspaceId;
  } else {
    return { ok: false, error: "missing_args" };
  }
  if (!sid || !wsId) return { ok: false, error: "missing_args" };

  await db
    .update(subscribers)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      unsubscribeReason: input.reason ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(subscribers.id, sid), eq(subscribers.workspaceId, wsId)));
  const [sub] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, sid), eq(subscribers.workspaceId, wsId)))
    .limit(1);
  if (!sub) return { ok: false, error: "not_found" };

  // Cancelar drips activos
  void (async () => {
    try {
      const { cancelEnrollmentsForSubscriber } = await import("./drip");
      await cancelEnrollmentsForSubscriber(sub.id, "unsubscribed");
    } catch (err) {
      console.error("[newsletter] cancelEnrollments failed:", err);
    }
  })();

  emitAsync({
    workspaceId: wsId,
    event: "subscriber.unsubscribed",
    payload: { subscriberId: sub.id, email: sub.email, reason: input.reason ?? null },
  });
  return { ok: true, subscriber: sub };
}

export async function recordBounce(
  subscriberId: string,
  workspaceId: string,
  reason?: string,
): Promise<void> {
  if (!db) return;
  await db
    .update(subscribers)
    .set({
      bounceCount: sql`coalesce(${subscribers.bounceCount}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(subscribers.id, subscriberId), eq(subscribers.workspaceId, workspaceId)));
  const [sub] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, subscriberId), eq(subscribers.workspaceId, workspaceId)))
    .limit(1);
  if (!sub) return;
  // 3 bounces consecutivos → marca como bounced
  if ((sub.bounceCount ?? 0) >= 3 && sub.status !== "bounced") {
    await db
      .update(subscribers)
      .set({ status: "bounced", updatedAt: new Date() })
      .where(eq(subscribers.id, subscriberId));
    emitAsync({
      workspaceId,
      event: "subscriber.bounced",
      payload: { subscriberId, email: sub.email, reason: reason ?? null },
    });
  }
}

export async function updatePreferences(input: {
  token: string;
  preferences?: Record<string, unknown>;
  tags?: string[];
}): Promise<{ ok: boolean; subscriber?: Subscriber; error?: string }> {
  if (!db) return { ok: false, error: "db_error" };
  const v = tokens.verifyPrefs(input.token);
  if (!v) return { ok: false, error: "invalid_token" };
  await db
    .update(subscribers)
    .set({
      preferences: input.preferences ?? null,
      tags: input.tags ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(subscribers.id, v.sid), eq(subscribers.workspaceId, v.ws)));
  const [sub] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, v.sid), eq(subscribers.workspaceId, v.ws)))
    .limit(1);
  if (!sub) return { ok: false, error: "not_found" };
  return { ok: true, subscriber: sub };
}

function mergeTags(existing: string[] | null, incoming: string[] | null): string[] | null {
  if (!incoming || incoming.length === 0) return null;
  const set = new Set(existing ?? []);
  for (const t of incoming) {
    const trimmed = t.trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set];
}

// ============================================================
// Listing & queries
// ============================================================

export type ListSubscribersOpts = {
  workspaceId: string;
  status?: "active" | "unsubscribed" | "bounced";
  q?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "email" | "lastOpenAt";
  direction?: "asc" | "desc";
};

export async function listSubscribers(opts: ListSubscribersOpts) {
  if (!db) return { rows: [], total: 0 };
  const conds = [eq(subscribers.workspaceId, opts.workspaceId)];
  if (opts.status) conds.push(eq(subscribers.status, opts.status));
  if (opts.q)
    conds.push(
      or(ilike(subscribers.email, `%${opts.q}%`), ilike(subscribers.name, `%${opts.q}%`))!,
    );
  if (opts.tag) conds.push(sql`${opts.tag} = ANY(${subscribers.tags})`);

  const [count] = await db
    .select({ c: countInt() })
    .from(subscribers)
    .where(and(...conds));
  const orderCol =
    opts.orderBy === "email"
      ? subscribers.email
      : opts.orderBy === "lastOpenAt"
        ? subscribers.lastOpenAt
        : subscribers.createdAt;

  const direction = opts.direction === "asc" ? asc : desc;
  const rows = await db
    .select()
    .from(subscribers)
    .where(and(...conds))
    .orderBy(direction(orderCol))
    .limit(Math.min(opts.limit ?? 50, 200))
    .offset(opts.offset ?? 0);
  return { rows, total: count?.c ?? 0 };
}

export async function getSubscriber(workspaceId: string, id: string): Promise<Subscriber | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, id), eq(subscribers.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function getSubscriberByEmail(
  workspaceId: string,
  email: string,
): Promise<Subscriber | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(subscribers)
    .where(
      and(eq(subscribers.workspaceId, workspaceId), eq(subscribers.email, normalizeEmail(email))),
    )
    .limit(1);
  return row ?? null;
}

export async function deleteSubscribers(workspaceId: string, ids: string[]): Promise<number> {
  if (!db || ids.length === 0) return 0;
  return await deleteReturningCount(
    subscribers,
    and(eq(subscribers.workspaceId, workspaceId), inArray(subscribers.id, ids))!,
  );
}

export async function tagSubscribers(
  workspaceId: string,
  ids: string[],
  add: string[],
  remove: string[] = [],
): Promise<number> {
  if (!db || ids.length === 0) return 0;
  let updated = 0;
  for (const id of ids) {
    const [sub] = await db
      .select({ id: subscribers.id, tags: subscribers.tags })
      .from(subscribers)
      .where(and(eq(subscribers.id, id), eq(subscribers.workspaceId, workspaceId)))
      .limit(1);
    if (!sub) continue;
    const set = new Set((sub.tags ?? []).filter((t) => !remove.includes(t)));
    for (const tag of add) {
      const trimmed = tag.trim();
      if (trimmed) set.add(trimmed);
    }
    await db
      .update(subscribers)
      .set({ tags: [...set], updatedAt: new Date() })
      .where(eq(subscribers.id, id));
    updated += 1;
  }
  return updated;
}

export async function bulkUnsubscribe(workspaceId: string, ids: string[]): Promise<number> {
  if (!db || ids.length === 0) return 0;
  // Pattern C cross-dialect: SELECT-then-UPDATE para obtener count de filas
  // afectadas (MySQL no soporta UPDATE...RETURNING).
  const where = and(eq(subscribers.workspaceId, workspaceId), inArray(subscribers.id, ids))!;
  const matched = await db.select({ id: subscribers.id }).from(subscribers).where(where);
  if (matched.length === 0) return 0;
  await db
    .update(subscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(where);
  return matched.length;
}

// ============================================================
// CSV import / export
// ============================================================

export type CsvImportRow = { email: string; name?: string; tags?: string };
export type CsvImportResult = {
  total: number;
  created: number;
  reactivated: number;
  skipped: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

export function parseSubscribersCsv(content: string): CsvImportRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const header = (lines[0] ?? "")
    .toLowerCase()
    .split(",")
    .map((c) => c.trim());
  const emailIdx = header.findIndex((h) => h === "email" || h === "e-mail" || h === "correo");
  const nameIdx = header.findIndex((h) => h === "name" || h === "nombre");
  const tagsIdx = header.findIndex((h) => h === "tags" || h === "etiquetas");

  const startIdx = emailIdx >= 0 ? 1 : 0;
  return lines.slice(startIdx).map((line) => {
    const cells = parseCsvLine(line);
    if (emailIdx >= 0) {
      return {
        email: cells[emailIdx] ?? "",
        name: nameIdx >= 0 ? cells[nameIdx] : undefined,
        tags: tagsIdx >= 0 ? cells[tagsIdx] : undefined,
      };
    }
    return { email: cells[0] ?? "" };
  });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"') {
        inQuotes = true;
      } else {
        cur += c ?? "";
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function bulkImport(
  workspaceId: string,
  rows: CsvImportRow[],
  opts: { source?: string; preConfirmed?: boolean } = {},
): Promise<CsvImportResult> {
  const result: CsvImportResult = {
    total: rows.length,
    created: 0,
    reactivated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const email = normalizeEmail(row.email);
    if (!isValidEmail(email)) {
      result.errors.push({ row: i + 2, email, reason: "Email inválido" });
      continue;
    }
    const tags = row.tags
      ? row.tags
          .split(/[;|]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : null;

    const res = await subscribe({
      workspaceId,
      email,
      name: row.name ?? null,
      source: opts.source ?? "csv",
      tags,
      preConfirmed: opts.preConfirmed ?? true, // imports manuales = preconfirmados por defecto
    });
    if (!res.ok) {
      result.skipped += 1;
      result.errors.push({ row: i + 2, email, reason: res.error });
      continue;
    }
    if (res.created) result.created += 1;
    else result.reactivated += 1;
  }

  await logActivity({
    workspaceId,
    action: "subscribers.bulk_import",
    targetType: "subscriber",
    meta: { ...result },
  });
  return result;
}

export function subscribersToCsv(rows: Subscriber[]): string {
  const escapeCell = (val: unknown): string => {
    const s = val === null || val === undefined ? "" : String(val);
    // OWASP CSV-formula-injection guard
    if (/^[=+\-@\t\r]/.test(s)) return `"'${s.replace(/"/g, '""')}"`;
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = ["email", "name", "status", "tags", "source", "createdAt", "confirmedAt"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.email,
        r.name ?? "",
        r.status,
        (r.tags ?? []).join("|"),
        r.source ?? "",
        r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? ""),
        r.confirmedAt instanceof Date ? r.confirmedAt.toISOString() : (r.confirmedAt ?? ""),
      ]
        .map(escapeCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

// ============================================================
// Para campañas: recipients de un segmento
// ============================================================

export async function loadActiveConfirmedSubscribers(workspaceId: string): Promise<Subscriber[]> {
  if (!db) return [];
  return db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.workspaceId, workspaceId),
        eq(subscribers.status, "active"),
        isNotNull(subscribers.confirmedAt),
      ),
    );
}

export async function loadByIds(workspaceId: string, ids: string[]): Promise<Subscriber[]> {
  if (!db || ids.length === 0) return [];
  return db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.workspaceId, workspaceId), inArray(subscribers.id, ids)));
}

export async function countSubscribersByCampaign(campaignId: string): Promise<number> {
  if (!db) return 0;
  const [c] = await db
    .select({ c: countInt() })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));
  return c?.c ?? 0;
}
