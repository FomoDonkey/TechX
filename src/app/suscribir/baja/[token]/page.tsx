import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { unsubscribe } from "@/newsletter/subscribers";
import { tokens } from "@/newsletter/tokens";
import { Heart, MailX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { UnsubscribeForm } from "./_form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cancelar suscripción",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const ws = features.database ? await getDefaultPublicWorkspace() : null;

  const verified = tokens.verifyUnsub(token);

  if (sp.confirmed === "1") {
    return (
      <ThemeShell workspaceId={ws?.id}>
        <PublicNav workspace={ws} />
        <main className="mx-auto max-w-xl px-4 py-16 md:py-24">
          <div className="rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-8 text-center md:p-12">
            <span className="mx-auto inline-flex size-14 items-center justify-center rounded-[var(--th-radius-pill)] bg-rose-500/15 text-rose-500">
              <Heart className="size-7" />
            </span>
            <h1
              className="mt-4 text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--th-font-display)" }}
            >
              Te echaremos de menos
            </h1>
            <p className="mt-3 text-[color:var(--th-fg-muted)]">
              Hemos dado de baja tu suscripción. No recibirás más emails de nuestra parte.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] px-5 py-3 font-medium"
            >
              Ir al inicio →
            </Link>
          </div>
        </main>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell workspaceId={ws?.id}>
      <PublicNav workspace={ws} />
      <main className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <div className="rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-8 md:p-12">
          <div className="text-center">
            <span className="mx-auto inline-flex size-14 items-center justify-center rounded-[var(--th-radius-pill)] bg-[color:var(--th-bg)] text-[color:var(--th-fg-muted)]">
              <MailX className="size-7" />
            </span>
            <h1
              className="mt-4 text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--th-font-display)" }}
            >
              ¿Cancelar tu suscripción?
            </h1>
            <p className="mt-3 text-[color:var(--th-fg-muted)]">
              Si confirmas, dejarás de recibir nuestros emails. Puedes resuscribirte en cualquier
              momento.
            </p>
          </div>
          {verified ? (
            <UnsubscribeForm token={token} />
          ) : (
            <p className="mt-8 text-center text-rose-500">
              Este enlace no es válido o ha caducado.
            </p>
          )}
        </div>
      </main>
    </ThemeShell>
  );
}
