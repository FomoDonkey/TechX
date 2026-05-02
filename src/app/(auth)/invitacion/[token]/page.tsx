import { getCurrentUser } from "@/auth/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { invitations, users, workspaces } from "@/db/schema";
import { env } from "@/env";
import { and, eq, isNull } from "drizzle-orm";
import { Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitation } from "./_accept";

type Params = { params: Promise<{ token: string }> };

async function loadInvitation(token: string) {
  if (!db) return null;
  const [row] = await db
    .select({
      invitation: invitations,
      workspace: workspaces,
      inviter: users,
    })
    .from(invitations)
    .innerJoin(workspaces, eq(invitations.workspaceId, workspaces.id))
    .leftJoin(users, eq(invitations.invitedBy, users.id))
    .where(and(eq(invitations.token, token), isNull(invitations.acceptedAt)))
    .limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const row = await loadInvitation(token);
  if (!row) {
    return { title: "Invitación no encontrada", robots: { index: false } };
  }
  const ogUrl = new URL("/api/og/invitation", env.NEXT_PUBLIC_APP_URL);
  ogUrl.searchParams.set("ws", row.workspace.name);
  ogUrl.searchParams.set("by", row.inviter?.name ?? "alguien");
  return {
    title: `Únete a ${row.workspace.name}`,
    openGraph: { images: [ogUrl.toString()] },
    twitter: { card: "summary_large_image", images: [ogUrl.toString()] },
  };
}

export default async function InvitationPage({ params }: Params) {
  const { token } = await params;
  const row = await loadInvitation(token);
  if (!row) {
    return (
      <AuthShell
        title="Invitación no válida"
        subtitle="Este enlace no existe, ya fue usado o ha caducado."
        footer={
          <Link
            href="/"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Volver a la landing
          </Link>
        }
      >
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-muted-foreground">
          Pídele a quien te invitó que te envíe un enlace nuevo. Las invitaciones caducan a los 7
          días por seguridad.
        </div>
      </AuthShell>
    );
  }

  const expired = row.invitation.expiresAt.getTime() < Date.now();
  const user = await getCurrentUser();

  return (
    <AuthShell
      title={
        <>
          <span className="gradient-text">{row.inviter?.name ?? "Alguien"}</span> te invita a{" "}
          <span className="text-foreground">{row.workspace.name}</span>
        </>
      }
      subtitle="Únete y empieza a colaborar en contenido y publicación."
      footer={
        <Link
          href="/"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Volver a la landing
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Workspace</span>
            <span className="font-medium">{row.workspace.name}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Tu rol</span>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary">
              {row.invitation.role}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Mail className="size-3.5" /> {row.invitation.email}
            </span>
          </div>
        </div>

        {expired ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Esta invitación ha caducado. Pídele a {row.inviter?.name ?? "el invitante"} que te envíe
            una nueva.
          </div>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para aceptar, primero inicia sesión con{" "}
              <span className="text-foreground">{row.invitation.email}</span>.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="gradient" size="lg" className="flex-1 rounded-xl">
                <Link href={`/login?next=/invitacion/${token}`}>Iniciar sesión</Link>
              </Button>
              <Button asChild variant="glass" size="lg" className="flex-1 rounded-xl">
                <Link href={`/registro?next=/invitacion/${token}`}>Crear cuenta</Link>
              </Button>
            </div>
          </div>
        ) : (
          <AcceptInvitation token={token} />
        )}

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Solo tú con este enlace puedes aceptar.
        </p>
      </div>
    </AuthShell>
  );
}
