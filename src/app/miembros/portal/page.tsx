import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { features } from "@/env";
import { getCurrentMemberSession } from "@/payments/member-auth";
import {
  MEMBERSHIP_STATUS_LABELS,
  formatPriceCents,
  getMembershipByEmail,
  getTier,
  intervalLabel,
  isMembershipActive,
  listTiers,
} from "@/payments/memberships";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import { eq } from "drizzle-orm";
import { CalendarClock, CheckCircle2, Crown, ExternalLink, LogOut, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutMemberAction } from "../_actions";

export const metadata: Metadata = { title: "Tu cuenta · Miembros" };
export const dynamic = "force-dynamic";

async function resolveWorkspaceForPage() {
  if (!db) return null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const id = host ? await resolveWorkspaceIdByHost(host) : null;
  if (id) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (ws) return ws;
  }
  const [first] = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1);
  return first ?? null;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{
    welcome?: string;
    canceled?: string;
    tier?: string;
    demo_portal?: string;
  }>;
}) {
  const sp = await searchParams;
  const ws = await resolveWorkspaceForPage();
  if (!ws) redirect("/");

  const session = await getCurrentMemberSession(ws.id);
  if (!session) redirect("/miembros");

  const [membership, allTiers] = await Promise.all([
    getMembershipByEmail(ws.id, session.email),
    listTiers(ws.id, { onlyActive: true }),
  ]);

  const tier = membership?.tierId ? await getTier(ws.id, membership.tierId) : null;
  const isActive = isMembershipActive(membership);
  const otherTiers = allTiers.filter((t) => t.id !== membership?.tierId);

  // Si vienen con ?tier=X y no son miembros activos, redirige a checkout
  if (sp.tier && /^[0-9a-f-]{36}$/.test(sp.tier) && !isActive) {
    redirect(`/api/stripe/checkout/${sp.tier}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12">
      {sp.welcome ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-200">¡Bienvenido!</p>
              <p className="mt-0.5 text-emerald-300/80">
                Tu acceso ya está activo. Puedes empezar a explorar el contenido exclusivo.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {sp.canceled ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Cancelaste el proceso de pago. Si fue sin querer, vuelve a intentarlo abajo.
        </div>
      ) : null}

      {sp.demo_portal ? (
        <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4 text-sm text-violet-200">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Modo demo activo</p>
              <p className="mt-0.5">
                Para gestionar facturación y pagos reales necesitas configurar Stripe en el admin.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Crown className="size-6 text-violet-400" /> Tu cuenta
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{session.email}</span> · {ws.name}
          </p>
        </div>
        <form action={logoutMemberAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="mr-1.5 size-4" />
            Cerrar sesión
          </Button>
        </form>
      </header>

      {/* Membership card */}
      <section className="rounded-3xl border bg-card/40 p-6">
        {membership ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">
                  {tier ? tier.name : "Miembro"}{" "}
                  {membership.cancelAtPeriodEnd ? (
                    <Badge variant="outline" className="ml-2 border-amber-400/40 text-amber-300">
                      Cancela al final del período
                    </Badge>
                  ) : null}
                </h2>
                {tier ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tier.priceCents === 0
                      ? "Plan gratuito"
                      : `${formatPriceCents(tier.priceCents, tier.currency)} ${intervalLabel(tier.interval)}`}
                  </p>
                ) : null}
              </div>
              <Badge
                variant="outline"
                className={
                  isActive
                    ? "border-emerald-400/40 text-emerald-300"
                    : "border-rose-400/40 text-rose-300"
                }
              >
                {MEMBERSHIP_STATUS_LABELS[membership.status]}
              </Badge>
            </div>

            {membership.currentPeriodEnd ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="size-4" />
                {membership.cancelAtPeriodEnd ? "Acaba" : "Renueva"} el{" "}
                {membership.currentPeriodEnd.toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            ) : null}

            {tier && (tier.features ?? []).length > 0 ? (
              <ul className="space-y-1.5 border-t pt-4 text-sm">
                {(tier.features ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              {features.stripe && membership.stripeCustomerId ? (
                <form action="/api/stripe/portal" method="post">
                  <Button type="submit" variant="outline" size="sm">
                    <ExternalLink className="mr-1.5 size-4" />
                    Gestionar facturación
                  </Button>
                </form>
              ) : null}
              {otherTiers.length > 0 && !membership.cancelAtPeriodEnd ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/miembros#tiers">Cambiar de plan</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <Sparkles className="mx-auto size-8 text-violet-400" />
            <h2 className="font-display text-xl">Aún no tienes un plan</h2>
            <p className="text-sm text-muted-foreground">
              Elige uno para desbloquear el contenido exclusivo.
            </p>
          </div>
        )}
      </section>

      {/* Tiers grid (always visible) */}
      {otherTiers.length > 0 || !membership ? (
        <section id="tiers" className="space-y-3">
          <h2 className="font-display text-lg">{membership ? "Otros planes" : "Elige tu plan"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(membership ? otherTiers : allTiers).map((t) => (
              <article
                key={t.id}
                className="flex flex-col rounded-2xl border bg-card/30 p-5 transition-colors hover:border-violet-400/40"
              >
                <h3 className="font-medium">{t.name}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold">
                    {t.priceCents === 0 ? "Gratis" : formatPriceCents(t.priceCents, t.currency)}
                  </span>
                  {t.priceCents > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {intervalLabel(t.interval)}
                    </span>
                  ) : null}
                </div>
                {t.description ? (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                ) : null}
                <form
                  action={`/api/stripe/checkout/${t.id}`}
                  method="post"
                  className="mt-auto pt-4"
                >
                  <Button type="submit" variant="outline" className="w-full" size="sm">
                    {membership ? "Cambiar a este plan" : "Suscribirme"}
                  </Button>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
