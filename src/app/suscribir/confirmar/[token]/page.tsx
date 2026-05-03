import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { db } from "@/db/client";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { confirmSubscription } from "@/newsletter/subscribers";
import { tokens } from "@/newsletter/tokens";
import { CheckCircle2, MailX, RotateCw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmando suscripción",
  robots: { index: false, follow: false },
};

export default async function ConfirmSubscriptionPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const ws = features.database ? await getDefaultPublicWorkspace() : null;
  const result = await confirmSubscription(token);

  return (
    <ThemeShell workspaceId={ws?.id}>
      <PublicNav workspace={ws} />
      <main className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <div className="rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-8 text-center md:p-12">
          {result.ok ? (
            <SuccessView
              email={result.subscriber?.email ?? ""}
              alreadyConfirmed={result.reason === "already_confirmed"}
            />
          ) : (
            <FailureView reason={result.reason ?? "invalid_token"} />
          )}
        </div>
      </main>
    </ThemeShell>
  );
}

function SuccessView({ email, alreadyConfirmed }: { email: string; alreadyConfirmed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="inline-flex size-14 items-center justify-center rounded-[var(--th-radius-pill)] bg-emerald-500/15 text-emerald-500">
        <CheckCircle2 className="size-7" />
      </span>
      <h1
        className="text-3xl font-bold tracking-tight"
        style={{ fontFamily: "var(--th-font-display)" }}
      >
        {alreadyConfirmed ? "Tu suscripción ya estaba confirmada" : "Suscripción confirmada ✦"}
      </h1>
      <p className="max-w-md text-[color:var(--th-fg-muted)]">
        {alreadyConfirmed
          ? `Recibimos a ${email} en la newsletter. ¡Gracias por tu paciencia!`
          : `Listo. ${email} recibirá nuestras nuevas publicaciones por email.`}
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-[var(--th-radius-md)] bg-[color:var(--th-brand)] px-5 py-3 font-medium text-[color:var(--th-brand-fg)]"
      >
        Volver al inicio →
      </Link>
    </div>
  );
}

function FailureView({ reason }: { reason: string }) {
  const Icon = reason === "expired" ? RotateCw : reason === "already_confirmed" ? MailX : XCircle;
  const title =
    reason === "expired"
      ? "Este enlace ya caducó"
      : reason === "invalid_token"
        ? "Enlace no válido"
        : "No pudimos confirmar tu suscripción";
  const message =
    reason === "expired"
      ? "Por seguridad los enlaces caducan a los 7 días. Suscríbete de nuevo y reenviaremos uno."
      : "Es posible que el enlace esté roto o ya haya sido usado.";
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="inline-flex size-14 items-center justify-center rounded-[var(--th-radius-pill)] bg-rose-500/15 text-rose-500">
        <Icon className="size-7" />
      </span>
      <h1
        className="text-3xl font-bold tracking-tight"
        style={{ fontFamily: "var(--th-font-display)" }}
      >
        {title}
      </h1>
      <p className="max-w-md text-[color:var(--th-fg-muted)]">{message}</p>
      <Link
        href="/suscribir"
        className="mt-2 inline-flex items-center gap-2 rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] px-5 py-3 font-medium"
      >
        Volver a suscribirme →
      </Link>
    </div>
  );
}
