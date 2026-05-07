import { getCurrentUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { passkeys, sessions, users } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import {
  Bot,
  CheckCircle2,
  Fingerprint,
  Lock,
  Mail,
  MessageSquareWarning,
  MonitorSmartphone,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Seguridad · techx" };
export const dynamic = "force-dynamic";

export default async function SeguridadPage() {
  const user = await getCurrentUser();
  if (!user || !db) redirect("/login");

  const [userRow] = await db
    .select({
      twoFactorEnabled: users.twoFactorEnabled,
      emailVerified: users.emailVerified,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const [passkeyCount] = await db
    .select({ n: count() })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));

  const [sessionCount] = await db
    .select({ n: count() })
    .from(sessions)
    .where(eq(sessions.userId, user.id));

  const twoFa = userRow?.twoFactorEnabled ?? false;
  const verified = userRow?.emailVerified ?? false;
  const pkN = passkeyCount?.n ?? 0;
  const sN = sessionCount?.n ?? 0;

  const cards: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
    icon: typeof ShieldCheck;
    state: "ok" | "warn" | "off";
    badge: string;
  }> = [
    {
      title: "Autenticación en 2 pasos",
      description:
        "Añade una capa extra usando una app autenticadora (Google Authenticator, 1Password, Bitwarden).",
      href: "/admin/ajustes/seguridad/2fa",
      cta: twoFa ? "Gestionar" : "Activar 2FA",
      icon: twoFa ? ShieldCheck : ShieldOff,
      state: twoFa ? "ok" : "warn",
      badge: twoFa ? "Activado" : "Sin proteger",
    },
    {
      title: "Passkeys",
      description:
        "Inicia sesión sin contraseña con tu huella, Face ID, Windows Hello o llave de seguridad.",
      href: "/admin/ajustes/seguridad/passkeys",
      cta: pkN > 0 ? "Gestionar" : "Añadir passkey",
      icon: Fingerprint,
      state: pkN > 0 ? "ok" : "warn",
      badge: pkN > 0 ? `${pkN} registrad${pkN === 1 ? "a" : "as"}` : "Ninguna",
    },
    {
      title: "Sesiones activas",
      description: "Dispositivos donde tu cuenta está abierta. Cierra los que no reconozcas.",
      href: "/admin/ajustes/seguridad/sesiones",
      cta: "Ver dispositivos",
      icon: MonitorSmartphone,
      state: sN > 1 ? "ok" : "ok",
      badge: `${sN} activa${sN === 1 ? "" : "s"}`,
    },
    {
      title: "Email verificado",
      description: verified
        ? `Tu email ${userRow?.email ?? ""} está verificado.`
        : "Aún no has confirmado tu email. Algunas acciones críticas requieren verificación.",
      href: "/admin/ajustes/perfil",
      cta: verified ? "Cambiar email" : "Verificar ahora",
      icon: verified ? CheckCircle2 : Mail,
      state: verified ? "ok" : "warn",
      badge: verified ? "Verificado" : "Pendiente",
    },
  ];

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Seguridad</h1>
        <p className="text-sm text-muted-foreground">
          Protege tu cuenta. Recomendamos tener 2FA o al menos una passkey activa.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.href}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-card p-5 transition-colors hover:bg-card/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                    card.state === "ok"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : card.state === "warn"
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <Badge
                  variant={
                    card.state === "ok"
                      ? "default"
                      : card.state === "warn"
                        ? "outline"
                        : "secondary"
                  }
                  className={
                    card.state === "ok"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : card.state === "warn"
                        ? "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : ""
                  }
                >
                  {card.badge}
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </div>
              <div className="mt-auto pt-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={card.href}>{card.cta}</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/ajustes/seguridad/headers"
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-card/80"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-500">
            <Lock className="size-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-semibold">Cabeceras de seguridad</h3>
            <p className="text-sm text-muted-foreground">
              CSP, HSTS, Permissions-Policy y reportes del navegador.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Avanzado
          </Badge>
        </Link>
        <Link
          href="/admin/ajustes/seguridad/anti-spam"
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-card/80"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-500">
            <Bot className="size-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-semibold">Anti-spam</h3>
            <p className="text-sm text-muted-foreground">
              BotID / Turnstile / hCaptcha + honeypot + rate-limit en endpoints públicos.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Workspace
          </Badge>
        </Link>
        <Link
          href="/admin/ajustes/seguridad/moderacion"
          className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-card/80"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
            <MessageSquareWarning className="size-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-semibold">Moderación de comentarios</h3>
            <p className="text-sm text-muted-foreground">
              Umbrales de auto-spam y revisión humana basados en score IA + heurística.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Workspace
          </Badge>
        </Link>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h3 className="font-semibold">Consejos rápidos</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>
            · Activa <strong>2FA</strong> y añade al menos <strong>una passkey</strong> de respaldo.
          </li>
          <li>
            · Guarda los <strong>códigos de recuperación</strong> en un gestor de contraseñas.
          </li>
          <li>
            · Revisa tus <strong>sesiones activas</strong> al menos una vez al mes.
          </li>
          <li>
            · Revoca tokens API que no uses en{" "}
            <Link href="/admin/api-keys" className="underline underline-offset-2">
              /admin/api-keys
            </Link>
            .
          </li>
        </ul>
      </div>
    </>
  );
}
