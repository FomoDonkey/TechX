/**
 * POST /api/ab/event — registra eventos A/B (impressions/conversions) desde
 * el cliente. Para v1 sólo aceptamos `kind: "conversion"` desde aquí; las
 * impressions se graban server-side en el SSR de la página.
 *
 * Auth:
 *  - No requiere session, pero exige cookie `csm_aid` válida.
 *  - El test debe estar en status=running.
 *  - Sólo aceptamos variantId que coincida con el assignment sticky del
 *    anonId (anti-fraude — no permitimos reportar conversion para una
 *    variant que el visitante no recibió).
 *
 * Rate limit: 30 events/min por anonId.
 */

import { ANON_COOKIE, isValidAnonId } from "@/ab/anon-id";
import { extractClientIp, recordConversion } from "@/ab/tracking";
import { consume } from "@/api/rate-limit";
import { db } from "@/db/client";
import { abAssignments, abTests } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Meta sólo acepta primitivos para evitar polución/parser cost de objetos
 * profundos. Para v1 cubre 99% de casos (revenue, item_id, channel…). */
const MetaPrimitiveSchema = z.union([z.string().max(256), z.number(), z.boolean(), z.null()]);

const BodySchema = z
  .object({
    /** Slug del test (preferido — evita exponer testId). */
    testKey: z
      .string()
      .max(64)
      .regex(/^[a-z0-9_-]+$/i),
    /** Si null, leemos el assignment sticky por (testId, anonId). */
    variantId: z
      .string()
      .max(32)
      .regex(/^[a-z0-9_-]+$/i)
      .optional(),
    /** Valor numérico (ej: revenue en céntimos). */
    value: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
    /** Metadata flat: claves string → primitivos. Cap ~1KB total stringified. */
    meta: z.record(z.string().max(64), MetaPrimitiveSchema).optional(),
    /** Sólo "conversion" desde cliente. */
    kind: z.literal("conversion").default("conversion"),
  })
  .strict();

const MAX_BODY_BYTES = 4096;

export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json({ error: "Database disabled" }, { status: 503 });

  const anonRaw = req.cookies.get(ANON_COOKIE)?.value;
  if (!anonRaw || !isValidAnonId(anonRaw)) {
    return NextResponse.json({ error: "anon_required" }, { status: 400 });
  }
  const anonId = anonRaw;

  // Rate limit: 30 conversions/min por anon. Suficiente para multi-CTA pages
  // sin abrir abuso.
  const rl = consume(`ab:event:${anonId}`, 30, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: rl.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Cap del body antes del JSON parse (evita parsear payloads enormes).
  const cl = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(cl) && cl > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "body_too_large" }, { status: 413 });
    }
    const raw = JSON.parse(text);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Cap meta size 1KB después de stringify (defensa por si claves x N inflan)
  if (body.meta && JSON.stringify(body.meta).length > 1024) {
    return NextResponse.json({ error: "meta_too_large" }, { status: 400 });
  }

  // El testKey es global por workspace+key, pero al ser pública necesitamos
  // localizar el workspace. Estrategia v1: resolvemos por host header (custom
  // domain → workspace, fallback al primer workspace en single-tenant).
  const { resolvePublicWorkspace } = await import("@/payments/public-workspace");
  const ws = await resolvePublicWorkspace(req);
  if (!ws) return NextResponse.json({ error: "workspace_unknown" }, { status: 404 });

  // Lookup del test
  const [test] = await db
    .select({
      id: abTests.id,
      status: abTests.status,
      variants: abTests.variants,
    })
    .from(abTests)
    .where(and(eq(abTests.workspaceId, ws.id), eq(abTests.key, body.testKey)))
    .limit(1);

  if (!test) return NextResponse.json({ error: "test_unknown" }, { status: 404 });
  if (test.status !== "running") {
    // No grabamos eventos de tests pausados/cerrados — pero respondemos 204
    // (silencio) para no leak status info.
    return new NextResponse(null, { status: 204 });
  }

  // Lookup assignment sticky
  const [assigned] = await db
    .select({ variantId: abAssignments.variantId })
    .from(abAssignments)
    .where(and(eq(abAssignments.testId, test.id), eq(abAssignments.anonId, anonId)))
    .limit(1);

  if (!assigned) {
    // Visitante nunca vio una variant — no contamos conversion.
    return NextResponse.json({ error: "no_assignment" }, { status: 409 });
  }

  // Si el cliente especifica variantId, debe coincidir con el assignment.
  // (Anti-fraude — no aceptamos reportes de variants que el visitante no
  // recibió.)
  if (body.variantId && body.variantId !== assigned.variantId) {
    return NextResponse.json({ error: "variant_mismatch" }, { status: 409 });
  }

  // Verifica que la variant existe en el test (config consistency)
  const variants = Array.isArray(test.variants) ? (test.variants as Array<{ id?: unknown }>) : [];
  const variantExists = variants.some(
    (v) => v && typeof v.id === "string" && v.id === assigned.variantId,
  );
  if (!variantExists) {
    return new NextResponse(null, { status: 204 });
  }

  await recordConversion({
    testId: test.id,
    workspaceId: ws.id,
    variantId: assigned.variantId,
    anonId,
    clientIp: extractClientIp(req.headers),
    value: body.value ?? null,
    meta: body.meta ?? null,
  });

  return NextResponse.json({ ok: true, variantId: assigned.variantId });
}
