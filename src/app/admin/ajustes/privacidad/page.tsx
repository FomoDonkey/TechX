import { getCurrentUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDeletionStatus } from "@/privacy/lib";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Cookie, Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cancelDeletionAction } from "./_actions";
import { RequestDeletionButton } from "./client";

export const metadata: Metadata = { title: "Privacidad · CSM" };
export const dynamic = "force-dynamic";

export default async function PrivacidadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const deletion = await getDeletionStatus(user.id);

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Privacidad</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona qué datos compartimos sobre ti, descarga una copia o cierra tu cuenta.
        </p>
      </header>

      {deletion.requested ? <DeletionBanner status={deletion} /> : null}

      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Download className="size-5" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Exportar mis datos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Descarga un ZIP con todo lo que sabemos de ti: perfil, sesiones, workspaces,
                entradas que has escrito, comentarios, passkeys (sólo metadatos), API keys (sin
                secrets) y los últimos 1000 eventos de tu activity log.
              </p>
            </div>
            <Button asChild>
              <a href="/api/admin/privacy/export">Descargar ZIP</a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Cumple con el derecho de portabilidad (RGPD art. 20).
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Cookie className="size-5" />
          </div>
          <div className="flex-1 space-y-3">
            <h2 className="text-base font-semibold">Cookies y consentimiento</h2>
            <p className="text-sm text-muted-foreground">
              Tu consentimiento actual se guarda en la cookie{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">csm_consent</code>. Para
              cambiar tu decisión, borra esa cookie en tu navegador y recarga — verás el banner de
              nuevo.
            </p>
            <Link
              href="/legal/cookies"
              className="text-sm text-primary underline underline-offset-2"
            >
              Política de cookies →
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive">
            <Trash2 className="size-5" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Eliminar mi cuenta</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Aplicamos un periodo de gracia de <strong>30 días</strong>. Durante ese tiempo
                puedes cancelar la solicitud iniciando sesión y volviendo aquí. Pasado el plazo, se
                borrará tu cuenta y todos los datos asociados de forma irreversible.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Antes de continuar te recomendamos{" "}
                <a href="/api/admin/privacy/export" className="underline underline-offset-2">
                  descargar tus datos
                </a>
                .
              </p>
            </div>
            {deletion.requested ? (
              <form action={cancelDeletionAction}>
                <Button type="submit" variant="secondary">
                  Cancelar eliminación
                </Button>
              </form>
            ) : (
              <RequestDeletionButton />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function DeletionBanner({
  status,
}: {
  status: {
    requested: boolean;
    requestedAt?: Date;
    scheduledFor?: Date;
    daysRemaining?: number;
  };
}) {
  if (!status.requested || !status.scheduledFor) return null;
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Eliminación de cuenta programada</p>
            <Badge variant="destructive" className="bg-destructive/20">
              {status.daysRemaining} {status.daysRemaining === 1 ? "día" : "días"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitada el{" "}
            {status.requestedAt
              ? format(status.requestedAt, "d 'de' MMMM 'a las' HH:mm", { locale: es })
              : "—"}
            . Se eliminará el{" "}
            <strong>{format(status.scheduledFor, "EEEE d 'de' MMMM yyyy", { locale: es })}</strong>.
            Para cancelar, usa el botón abajo.
          </p>
        </div>
      </div>
    </div>
  );
}
