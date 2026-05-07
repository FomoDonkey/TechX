import { getCurrentUser } from "@/auth/server";
import { ProfileEmailVerification } from "@/components/admin/ajustes/profile-email-verification";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Perfil · techx" };
export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user || !db) redirect("/login");

  const [u] = await db
    .select({
      email: users.email,
      emailVerified: users.emailVerified,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Información personal y verificación de email.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Email</h2>
            <p className="text-sm text-muted-foreground">
              Usado para iniciar sesión y recibir notificaciones.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-mono">{u?.email}</span>
          <span className="text-xs text-muted-foreground">{u?.name}</span>
        </div>
        <ProfileEmailVerification email={u?.email ?? ""} verified={u?.emailVerified ?? false} />
      </section>

      <div className="text-sm">
        <Link
          href="/admin/ajustes/seguridad"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Volver a Ajustes
        </Link>
      </div>
    </>
  );
}
