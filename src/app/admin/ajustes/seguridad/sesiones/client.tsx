"use client";

import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Laptop, MonitorSmartphone, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UAParser } from "ua-parser-js";

export type SessionRow = {
  id: string;
  token: string;
  ipMasked: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export function SessionsClient({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyToken, setBusyToken] = useState<string | null>(null);

  async function revokeOne(token: string) {
    if (!confirm("¿Cerrar esta sesión?")) return;
    setBusyToken(token);
    try {
      await authClient.revokeSession({ token });
      startTransition(() => router.refresh());
    } finally {
      setBusyToken(null);
    }
  }

  async function revokeOthers() {
    if (!confirm("¿Cerrar el resto de sesiones? La sesión actual seguirá activa.")) return;
    try {
      await authClient.revokeOtherSessions();
      startTransition(() => router.refresh());
    } catch (e) {
      console.error(e);
    }
  }

  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sesiones activas</h1>
        <p className="text-sm text-muted-foreground">
          Dispositivos donde tu cuenta está abierta. Si ves alguno que no reconoces, ciérralo.
        </p>
      </header>

      {others.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={revokeOthers} disabled={pending}>
            Cerrar todas las demás ({others.length})
          </Button>
        </div>
      ) : null}

      <ul className="divide-y rounded-xl border bg-card">
        {sessions.map((s) => {
          const ua = parseUA(s.userAgent);
          const Icon =
            ua.kind === "mobile" ? Smartphone : ua.kind === "tablet" ? MonitorSmartphone : Laptop;
          return (
            <li
              key={s.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{ua.label}</span>
                    {s.isCurrent ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Esta sesión
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ua.os}
                    {s.ipMasked ? ` · IP ${s.ipMasked}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activa hace {formatDistanceToNow(new Date(s.updatedAt), { locale: es })} ·
                    Caduca{" "}
                    {formatDistanceToNow(new Date(s.expiresAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                </div>
              </div>
              {!s.isCurrent ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeOne(s.token)}
                  disabled={busyToken === s.token}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {busyToken === s.token ? "Cerrando…" : "Cerrar sesión"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="text-sm">
        <Link
          href="/admin/ajustes/seguridad"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Volver a Seguridad
        </Link>
      </div>
    </>
  );
}

function parseUA(ua: string | null): {
  label: string;
  os: string;
  kind: "desktop" | "mobile" | "tablet";
} {
  if (!ua) return { label: "Dispositivo desconocido", os: "—", kind: "desktop" };
  const parser = new UAParser(ua);
  const { browser, os, device } = parser.getResult();
  const kind: "desktop" | "mobile" | "tablet" =
    device.type === "mobile" ? "mobile" : device.type === "tablet" ? "tablet" : "desktop";
  const label = browser.name
    ? `${browser.name}${browser.version ? ` ${browser.version.split(".")[0]}` : ""}`
    : "Navegador desconocido";
  const osLabel = os.name ? `${os.name}${os.version ? ` ${os.version}` : ""}` : "—";
  return { label, os: osLabel, kind };
}
