import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { features } from "@/env";
import { safeInternalPath } from "@/lib/safe-redirect";
import { getCurrentMemberSession } from "@/payments/member-auth";
import { formatPriceCents, intervalLabel, listTiers } from "@/payments/memberships";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import { eq } from "drizzle-orm";
import { Check, Crown, Mail, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "./_form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<Metadata> {
  const ws = await resolveWorkspaceForPage();
  void searchParams;
  return {
    title: ws ? `Miembros · ${ws.name}` : "Miembros",
    description: "Únete como miembro y desbloquea contenido exclusivo.",
  };
}

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

export default async function MiembrosPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    tier?: string;
    logged_out?: string;
    invalid_link?: string;
  }>;
}) {
  const sp = await searchParams;
  const ws = await resolveWorkspaceForPage();
  if (!ws) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-24 text-center">
        <h1 className="font-display text-2xl">Membresías no disponibles</h1>
        <p className="text-muted-foreground">El sitio aún no está configurado.</p>
      </main>
    );
  }

  // Si ya hay sesión, redirige al portal salvo que vengan de logout.
  if (!sp.logged_out) {
    const session = await getCurrentMemberSession(ws.id);
    if (session) {
      redirect(safeInternalPath(sp.next, "/miembros/portal"));
    }
  }

  const tiers = (await listTiers(ws.id, { onlyActive: true })).filter((t) => t.isActive);

  return (
    <main className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative px-6 py-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(155,92,255,0.15),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(255,93,177,0.12),transparent_60%)]" />
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <Badge
            variant="outline"
            className="mx-auto inline-flex gap-1.5 border-violet-400/30 bg-violet-500/10 text-violet-300"
          >
            <Crown className="size-3" /> Miembros de {ws.name}
          </Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Únete y desbloquea lo bueno
            <span className="block bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              de verdad
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Recibe contenido exclusivo, comenta sin esperar y apoya el proyecto. Sin contraseñas:
            entras con un enlace mágico a tu email.
          </p>
        </div>
      </section>

      {/* Tiers */}
      {tiers.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-6 pb-12">
          <div className={`grid gap-5 ${tiersGridCols(tiers.length)}`}>
            {tiers.map((t) => (
              <article
                key={t.id}
                className="group relative flex flex-col rounded-2xl border bg-card/40 p-6 transition-all hover:-translate-y-1 hover:border-violet-400/40 hover:shadow-2xl hover:shadow-violet-500/10"
              >
                <h3 className="font-display text-lg font-semibold">{t.name}</h3>
                {t.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                ) : null}
                <div className="mt-4 flex items-baseline gap-1.5">
                  {t.priceCents === 0 ? (
                    <span className="font-display text-3xl font-semibold">Gratis</span>
                  ) : (
                    <>
                      <span className="font-display text-3xl font-semibold">
                        {formatPriceCents(t.priceCents, t.currency)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {intervalLabel(t.interval)}
                      </span>
                    </>
                  )}
                </div>
                {t.trialDays > 0 ? (
                  <p className="mt-1 text-xs text-violet-300">
                    {t.trialDays} días de prueba gratis
                  </p>
                ) : null}
                {(t.features ?? []).length > 0 ? (
                  <ul className="mt-5 space-y-2 text-sm">
                    {(t.features ?? []).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-foreground/85">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <a
                  href={`/miembros?tier=${t.id}#login`}
                  className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-shadow hover:shadow-violet-500/40"
                >
                  Suscribirme
                </a>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Login */}
      <section id="login" className="mx-auto w-full max-w-md px-6 pb-24 pt-6">
        <div className="rounded-3xl border bg-card/60 p-8 backdrop-blur">
          <div className="mb-5 flex items-center gap-2">
            <Mail className="size-5 text-violet-400" />
            <h2 className="font-display text-lg font-semibold">Entrar como miembro</h2>
          </div>
          {sp.logged_out ? (
            <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              Sesión cerrada con éxito.
            </div>
          ) : null}
          {sp.invalid_link ? (
            <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              El enlace ha caducado, ya se usó, o no es correcto. Pide uno nuevo abajo.
            </div>
          ) : null}
          <p className="mb-5 text-sm text-muted-foreground">
            Te enviamos un enlace mágico a tu email. Caduca en 15 minutos y solo se puede usar una
            vez.
          </p>
          <MagicLinkForm
            workspaceId={ws.id}
            redirectTo={sp.tier ? `/miembros/portal?tier=${sp.tier}` : "/miembros/portal"}
          />
          {!features.email ? (
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-amber-300">
              <Sparkles className="size-3" />
              Email no configurado: el enlace aparecerá en la consola del servidor.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function tiersGridCols(n: number): string {
  if (n === 1) return "grid-cols-1 max-w-md mx-auto";
  if (n === 2) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
}
