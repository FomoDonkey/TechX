import { scoreComment } from "@/ai/moderation";
import { env } from "@/env";
import { verifyAntiBot } from "@/lib/anti-bot";
import { createComment, getEntryForComment, hashIp } from "@/lib/comments";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().min(1).max(160),
  parentId: z.string().uuid().nullable().optional(),
  authorName: z.string().min(1).max(80),
  authorEmail: z.string().email().max(200),
  body: z.string().min(2).max(5000),
  /** Honeypot — debe venir vacío. Cualquier valor → spam silencioso. */
  hp: z.string().optional(),
  /** Token captcha (Turnstile/hCaptcha) si el sitio lo configura. Opcional. */
  csm_captcha: z.string().optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Honeypot anti-bot
  if (data.hp && data.hp.length > 0) {
    return NextResponse.json({ ok: true, status: "spam" });
  }

  // Anti-bot adicional (Turnstile/hCaptcha/BotID si configurados).
  const ip0 =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const antiBot = await verifyAntiBot({ token: data.csm_captcha ?? null, ip: ip0 });
  if (!antiBot.ok) {
    // missing_token + provider activo → 200 silencioso (igual que honeypot, no
    // delatamos al spammer). verify_failed → 403 explícito (humano con token
    // caducado merece feedback).
    if (antiBot.reason === "missing_token") {
      return NextResponse.json({ ok: true, status: "spam" });
    }
    return NextResponse.json(
      { ok: false, error: "captcha_failed", provider: antiBot.provider },
      { status: 403 },
    );
  }

  // TODO(custom-domains): cuando F5+ resuelva workspace por host, sustituir esto.
  const ws = await getDefaultPublicWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: "Workspace público no configurado" },
      { status: 503 },
    );
  }

  const entry = await getEntryForComment(ws.id, data.slug);
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Post no encontrado" }, { status: 404 });
  }

  // Score IA + heurística
  const score = await scoreComment({ body: data.body, authorName: data.authorName });

  const ua = req.headers.get("user-agent") ?? undefined;

  const created = await createComment({
    workspaceId: entry.workspaceId,
    entryId: entry.id,
    parentId: data.parentId ?? null,
    authorName: data.authorName,
    authorEmail: data.authorEmail,
    body: data.body,
    ipHash: hashIp(ip0, env.AUTH_SECRET),
    userAgent: ua,
    aiScore: score.score,
    aiReason: score.reason,
  });
  if (!created) {
    return NextResponse.json({ ok: false, error: "DB no configurada" }, { status: 503 });
  }

  if (created.status === "approved") {
    revalidatePath(`/blog/${data.slug}`);
  }

  return NextResponse.json({
    ok: true,
    status: created.status,
    score: score.score,
    reason: score.reason,
  });
}
