/**
 * Domain layer de Memberships y Tiers.
 *
 * Reglas:
 *   - Tiers gratis (priceCents=0 o isFree=true) se conceden sin Stripe (source="free").
 *   - El estado "active" cubre tanto trialing como subscriptions activas para
 *     evaluación de paywall (ver `isMembershipActive`).
 *   - currentPeriodEnd es la fuente de verdad para "expirada"; si es null se asume
 *     activa indefinidamente (manual/lifetime).
 */

import { db } from "@/db/client";
import { countInt, deleteReturningCount, insertReturning, upsertReturning } from "@/db/dialect";
import { type Membership, type Tier, memberEvents, memberships, tiers } from "@/db/schema";
import { slugify, withSuffix } from "@/lib/slug";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

// ============================================================
// TIERS
// ============================================================
export async function listTiers(workspaceId: string, opts: { onlyActive?: boolean } = {}) {
  if (!db) return [] as Tier[];
  const conditions = [eq(tiers.workspaceId, workspaceId)];
  if (opts.onlyActive) conditions.push(eq(tiers.isActive, true));
  return db
    .select()
    .from(tiers)
    .where(and(...conditions))
    .orderBy(asc(tiers.sortOrder), asc(tiers.priceCents), asc(tiers.createdAt));
}

export async function getTier(workspaceId: string, id: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(tiers)
    .where(and(eq(tiers.workspaceId, workspaceId), eq(tiers.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTierBySlug(workspaceId: string, slug: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(tiers)
    .where(and(eq(tiers.workspaceId, workspaceId), eq(tiers.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTierByStripePrice(workspaceId: string, stripePriceId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(tiers)
    .where(and(eq(tiers.workspaceId, workspaceId), eq(tiers.stripePriceId, stripePriceId)))
    .limit(1);
  return rows[0] ?? null;
}

export type CreateTierInput = {
  name: string;
  slug?: string;
  description?: string | null;
  priceCents: number;
  currency?: string;
  interval?: "month" | "year" | "lifetime";
  trialDays?: number;
  features?: string[];
  isActive?: boolean;
  isFree?: boolean;
  sortOrder?: number;
};

async function ensureUniqueTierSlug(workspaceId: string, base: string): Promise<string> {
  if (!db) return base;
  const slug = slugify(base) || "tier";
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? slug : withSuffix(slug, i);
    const existing = await db
      .select({ id: tiers.id })
      .from(tiers)
      .where(and(eq(tiers.workspaceId, workspaceId), eq(tiers.slug, candidate)))
      .limit(1);
    if (!existing[0]) return candidate;
  }
  return withSuffix(slug, Math.floor(Math.random() * 1000));
}

export async function createTier(workspaceId: string, input: CreateTierInput): Promise<Tier> {
  if (!db) throw new Error("DB no disponible");
  const slug = await ensureUniqueTierSlug(workspaceId, input.slug ?? input.name);
  const isFree = input.isFree ?? input.priceCents === 0;
  const id = crypto.randomUUID();
  const row = (await insertReturning(tiers, {
    id,
    workspaceId,
    name: input.name,
    slug,
    description: input.description ?? null,
    priceCents: input.priceCents,
    currency: input.currency ?? "eur",
    interval: input.interval ?? "month",
    trialDays: input.trialDays ?? 0,
    features: input.features ?? [],
    isActive: input.isActive ?? true,
    isFree,
    sortOrder: input.sortOrder ?? 0,
  })) as Tier;
  if (!row) throw new Error("No se pudo crear el tier");
  return row;
}

export type UpdateTierInput = Partial<CreateTierInput> & {
  stripeProductId?: string | null;
  stripePriceId?: string | null;
};

export async function updateTier(
  workspaceId: string,
  id: string,
  patch: UpdateTierInput,
): Promise<Tier | null> {
  if (!db) return null;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.priceCents !== undefined) updates.priceCents = patch.priceCents;
  if (patch.currency !== undefined) updates.currency = patch.currency;
  if (patch.interval !== undefined) updates.interval = patch.interval;
  if (patch.trialDays !== undefined) updates.trialDays = patch.trialDays;
  if (patch.features !== undefined) updates.features = patch.features;
  if (patch.isActive !== undefined) updates.isActive = patch.isActive;
  if (patch.isFree !== undefined) updates.isFree = patch.isFree;
  if (patch.sortOrder !== undefined) updates.sortOrder = patch.sortOrder;
  if (patch.stripeProductId !== undefined) updates.stripeProductId = patch.stripeProductId;
  if (patch.stripePriceId !== undefined) updates.stripePriceId = patch.stripePriceId;
  if (patch.slug !== undefined) {
    updates.slug = await ensureUniqueTierSlug(workspaceId, patch.slug);
  }

  await db
    .update(tiers)
    .set(updates)
    .where(and(eq(tiers.workspaceId, workspaceId), eq(tiers.id, id)));
  const [row] = await db
    .select()
    .from(tiers)
    .where(and(eq(tiers.workspaceId, workspaceId), eq(tiers.id, id)))
    .limit(1);
  return row ?? null;
}

export async function deleteTier(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  const count = await deleteReturningCount(
    tiers,
    and(eq(tiers.workspaceId, workspaceId), eq(tiers.id, id))!,
  );
  return count > 0;
}

// ============================================================
// MEMBERSHIPS
// ============================================================
export async function getMembershipByEmail(
  workspaceId: string,
  email: string,
): Promise<Membership | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.email, email.trim().toLowerCase()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getMembershipByStripeSubscription(
  stripeSubscriptionId: string,
): Promise<Membership | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(memberships)
    .where(eq(memberships.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

export const ACTIVE_MEMBERSHIP_STATUSES = ["active", "trialing", "past_due"] as const;

export async function countActiveMembersByTier(workspaceId: string): Promise<Map<string, number>> {
  if (!db) return new Map();
  const rows = await db
    .select({
      tierId: memberships.tierId,
      count: countInt(),
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        inArray(memberships.status, [...ACTIVE_MEMBERSHIP_STATUSES]),
      ),
    )
    .groupBy(memberships.tierId);
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.tierId) out.set(r.tierId, r.count);
  }
  return out;
}

export async function membershipKpis(workspaceId: string): Promise<{
  total: number;
  active: number;
  trialing: number;
  canceled: number;
  pastDue: number;
}> {
  if (!db) return { total: 0, active: 0, trialing: 0, canceled: 0, pastDue: 0 };
  const rows = await db
    .select({
      status: memberships.status,
      count: countInt(),
    })
    .from(memberships)
    .where(eq(memberships.workspaceId, workspaceId))
    .groupBy(memberships.status);
  const out = { total: 0, active: 0, trialing: 0, canceled: 0, pastDue: 0 };
  for (const r of rows) {
    out.total += r.count;
    if (r.status === "active") out.active += r.count;
    if (r.status === "trialing") out.trialing += r.count;
    if (r.status === "canceled") out.canceled += r.count;
    if (r.status === "past_due") out.pastDue += r.count;
  }
  return out;
}

export async function listMemberships(
  workspaceId: string,
  opts: { status?: Membership["status"]; tierId?: string; limit?: number; offset?: number } = {},
) {
  if (!db) return { rows: [] as Membership[], total: 0 };
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const conditions = [eq(memberships.workspaceId, workspaceId)];
  if (opts.status) conditions.push(eq(memberships.status, opts.status));
  if (opts.tierId) conditions.push(eq(memberships.tierId, opts.tierId));

  const where = and(...conditions);
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(memberships)
      .where(where)
      .orderBy(desc(memberships.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: countInt() }).from(memberships).where(where),
  ]);
  return { rows, total: totalResult[0]?.count ?? 0 };
}

export type GrantMembershipInput = {
  workspaceId: string;
  email: string;
  name?: string | null;
  tierId: string | null;
  status?: Membership["status"];
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date | null;
  source?: string | null;
  metadata?: unknown;
};

/**
 * Idempotente: si ya existe membership para (ws, email), actualiza; si no, crea.
 * Usado por checkout.session.completed, manual grant, free tier signup.
 */
export async function grantMembership(input: GrantMembershipInput): Promise<Membership> {
  if (!db) throw new Error("DB no disponible");
  const email = input.email.trim().toLowerCase();
  const now = new Date();

  // Construimos el SET de UPDATE solo con los campos que vienen definidos.
  // Esto preserva campos pre-existentes que el caller no quiere tocar.
  const updateSet: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) updateSet.name = input.name;
  if (input.tierId !== undefined) updateSet.tierId = input.tierId;
  if (input.status) updateSet.status = input.status;
  if (input.stripeCustomerId !== undefined) updateSet.stripeCustomerId = input.stripeCustomerId;
  if (input.stripeSubscriptionId !== undefined)
    updateSet.stripeSubscriptionId = input.stripeSubscriptionId;
  if (input.currentPeriodStart !== undefined)
    updateSet.currentPeriodStart = input.currentPeriodStart;
  if (input.currentPeriodEnd !== undefined) updateSet.currentPeriodEnd = input.currentPeriodEnd;
  if (input.cancelAtPeriodEnd !== undefined) updateSet.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
  if (input.trialEnd !== undefined) updateSet.trialEnd = input.trialEnd;
  if (input.source !== undefined) updateSet.source = input.source;
  if (input.metadata !== undefined) updateSet.metadata = input.metadata;

  // Atomic upsert por (workspaceId, email) — evita race entre dos webhooks
  // concurrentes que ambos hacen "select then insert" y chocan con unique.
  const row = (await upsertReturning(memberships, {
    values: {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      email,
      name: input.name ?? null,
      tierId: input.tierId,
      status: input.status ?? "active",
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      currentPeriodStart: input.currentPeriodStart ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      trialEnd: input.trialEnd ?? null,
      source: input.source ?? "manual",
      metadata: input.metadata ?? null,
    },
    target: [memberships.workspaceId, memberships.email],
    uniqueKey: { workspaceId: input.workspaceId, email },
    set: updateSet,
  })) as Membership;
  if (!row) throw new Error("No se pudo upsertear la membresía");
  return row;
}

export async function updateMembershipFromSubscription(input: {
  workspaceId: string;
  membershipId: string;
  status: Membership["status"];
  tierId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  trialEnd?: Date | null;
}): Promise<Membership | null> {
  if (!db) return null;
  const updates: Record<string, unknown> = {
    status: input.status,
    updatedAt: new Date(),
  };
  if (input.tierId !== undefined) updates.tierId = input.tierId;
  if (input.currentPeriodStart !== undefined) updates.currentPeriodStart = input.currentPeriodStart;
  if (input.currentPeriodEnd !== undefined) updates.currentPeriodEnd = input.currentPeriodEnd;
  if (input.cancelAtPeriodEnd !== undefined) updates.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
  if (input.canceledAt !== undefined) updates.canceledAt = input.canceledAt;
  if (input.trialEnd !== undefined) updates.trialEnd = input.trialEnd;

  await db
    .update(memberships)
    .set(updates)
    .where(
      and(eq(memberships.workspaceId, input.workspaceId), eq(memberships.id, input.membershipId)),
    );
  const [row] = await db
    .select()
    .from(memberships)
    .where(
      and(eq(memberships.workspaceId, input.workspaceId), eq(memberships.id, input.membershipId)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Para evaluar paywalls: una membresía cuenta como activa si su status es
 * trialing/active/past_due (Stripe pasa a past_due antes de unpaid; durante
 * past_due seguimos dejando entrar, política blanda) Y currentPeriodEnd no ha
 * pasado (o es null = lifetime/manual).
 */
export function isMembershipActive(m: Membership | null | undefined): boolean {
  if (!m) return false;
  if (m.status !== "trialing" && m.status !== "active" && m.status !== "past_due") return false;
  if (m.currentPeriodEnd && m.currentPeriodEnd.getTime() < Date.now()) return false;
  return true;
}

export function membershipMatchesTiers(
  m: Membership | null | undefined,
  tierIds: string[],
): boolean {
  if (!m || !isMembershipActive(m)) return false;
  if (tierIds.length === 0) return true;
  return m.tierId !== null && tierIds.includes(m.tierId);
}

// ============================================================
// AUDIT LOG
// ============================================================
/**
 * Inserta un evento al audit log. Si `stripeEventId` ya existe (dedup), devuelve
 * `inserted: false` SIN escribir nada. Útil para reclamar atómicamente eventos
 * de Stripe (o tokens demo via "demo:${jti}") y evitar doble-procesamiento.
 */
export async function recordMemberEvent(input: {
  workspaceId: string;
  membershipId?: string | null;
  email?: string | null;
  type: typeof memberEvents.$inferInsert.type;
  stripeEventId?: string | null;
  data?: unknown;
}): Promise<{ inserted: boolean; id: string | null }> {
  if (!db) return { inserted: false, id: null };
  try {
    // Si viene stripeEventId, primero comprobamos si ya existe (dedup explícito
    // cross-dialect). Si no viene, insertamos siempre. Esto sustituye al
    // `onConflictDoNothing.returning()` que era Postgres-only.
    const stripeEventId = input.stripeEventId ?? null;
    if (stripeEventId) {
      const existing = await db
        .select({ id: memberEvents.id })
        .from(memberEvents)
        .where(eq(memberEvents.stripeEventId, stripeEventId))
        .limit(1);
      if (existing.length > 0) return { inserted: false, id: null };
    }
    const id = crypto.randomUUID();
    await db.insert(memberEvents).values({
      id,
      workspaceId: input.workspaceId,
      membershipId: input.membershipId ?? null,
      email: input.email ?? null,
      type: input.type,
      stripeEventId,
      data: input.data ?? null,
    });
    return { inserted: true, id };
  } catch (err) {
    console.error("recordMemberEvent failed", err);
    return { inserted: false, id: null };
  }
}

/** Devuelve true si ya procesamos este event.id de Stripe. */
export async function stripeEventAlreadyProcessed(stripeEventId: string): Promise<boolean> {
  if (!db) return false;
  const rows = await db
    .select({ id: memberEvents.id })
    .from(memberEvents)
    .where(eq(memberEvents.stripeEventId, stripeEventId))
    .limit(1);
  return rows.length > 0;
}

// ============================================================
// FORMAT helpers (UI)
// ============================================================
export function formatPriceCents(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function intervalLabel(interval: "month" | "year" | "lifetime"): string {
  switch (interval) {
    case "month":
      return "/mes";
    case "year":
      return "/año";
    case "lifetime":
      return "una vez";
  }
}

export const MEMBERSHIP_STATUS_LABELS: Record<Membership["status"], string> = {
  incomplete: "Incompleta",
  trialing: "En prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  unpaid: "Impagada",
  paused: "Pausada",
};
