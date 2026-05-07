import { Badge } from "@/components/ui/badge";
import { features } from "@/env";
import { requireWorkspace } from "@/lib/workspace";
import {
  MEMBERSHIP_STATUS_LABELS,
  countActiveMembersByTier,
  formatPriceCents,
  intervalLabel,
  listMemberships,
  listTiers,
  membershipKpis,
} from "@/payments/memberships";
import { Crown, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import { MembersTable, TiersBoard } from "./_client";

export const metadata: Metadata = { title: "Membresías · techx" };
export const dynamic = "force-dynamic";

export default async function MembresiasPage() {
  const ctx = await requireWorkspace("editor");
  const [tiers, members, counts, kpis] = await Promise.all([
    listTiers(ctx.workspace.id),
    listMemberships(ctx.workspace.id, { limit: 25 }),
    countActiveMembersByTier(ctx.workspace.id),
    membershipKpis(ctx.workspace.id),
  ]);

  const tierMap = new Map(tiers.map((t) => [t.id, t] as const));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Crown className="size-6 text-[color:var(--th-brand,#9b5cff)]" />
              Membresías
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Define tus planes, sincroniza con Stripe y gatea contenido por nivel. Los miembros se
              autentican por magic link, sin contraseña.
            </p>
          </div>
          {features.stripe ? (
            <Badge variant="outline" className="gap-1.5">
              <Zap className="size-3.5" /> Stripe conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 border-amber-400/40 text-amber-300">
              <Sparkles className="size-3.5" /> Modo demo (sin Stripe)
            </Badge>
          )}
        </div>

        <KpiGrid kpis={kpis} />
      </header>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Tiers</h2>
            <p className="text-xs text-muted-foreground">
              Crea planes free o de pago. Sincroniza con Stripe para abrir checkout real.
            </p>
          </div>
        </div>
        <TiersBoard
          tiers={tiers.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            description: t.description,
            priceCents: t.priceCents,
            currency: t.currency,
            interval: t.interval,
            trialDays: t.trialDays,
            features: t.features ?? [],
            isActive: t.isActive,
            isFree: t.isFree,
            sortOrder: t.sortOrder,
            stripePriceId: t.stripePriceId,
            stripeProductId: t.stripeProductId,
            activeMembers: counts.get(t.id) ?? 0,
          }))}
          stripeAvailable={features.stripe}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Miembros recientes</h2>
            <p className="text-xs text-muted-foreground">
              {members.total} {members.total === 1 ? "miembro" : "miembros"} en total
            </p>
          </div>
        </div>
        {members.rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Users className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              Aún no hay miembros. Comparte el enlace <code>/miembros</code> en tu sitio para que
              empiecen a registrarse.
            </p>
          </div>
        ) : (
          <MembersTable
            members={members.rows.map((m) => ({
              id: m.id,
              email: m.email,
              name: m.name,
              tierName: m.tierId ? (tierMap.get(m.tierId)?.name ?? "—") : "Sin plan",
              status: m.status,
              statusLabel: MEMBERSHIP_STATUS_LABELS[m.status],
              currentPeriodEnd: m.currentPeriodEnd?.toISOString() ?? null,
              source: m.source,
              createdAt: m.createdAt.toISOString(),
              cancelAtPeriodEnd: m.cancelAtPeriodEnd,
            }))}
            tiers={tiers.map((t) => ({
              id: t.id,
              name: t.name,
              priceLabel:
                t.priceCents === 0
                  ? "Gratis"
                  : `${formatPriceCents(t.priceCents, t.currency)} ${intervalLabel(t.interval)}`,
            }))}
          />
        )}
      </section>
    </div>
  );
}

function KpiGrid({
  kpis,
}: {
  kpis: { total: number; active: number; trialing: number; canceled: number; pastDue: number };
}) {
  const items = [
    { label: "Total", value: kpis.total, icon: Users, accent: "text-foreground" },
    { label: "Activas", value: kpis.active, icon: TrendingUp, accent: "text-emerald-300" },
    { label: "En prueba", value: kpis.trialing, icon: Sparkles, accent: "text-violet-300" },
    { label: "Pago pendiente", value: kpis.pastDue, icon: Zap, accent: "text-amber-300" },
    { label: "Canceladas", value: kpis.canceled, icon: Users, accent: "text-muted-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="rounded-2xl border bg-card/40 p-4 transition-colors hover:bg-card/60"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {it.label}
              </span>
              <Icon className={`size-4 ${it.accent}`} />
            </div>
            <div className={`mt-1 text-2xl font-semibold ${it.accent}`}>{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}
