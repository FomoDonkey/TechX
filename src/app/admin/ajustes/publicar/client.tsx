"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Cloud,
  Copy,
  ExternalLink,
  Globe,
  Lightbulb,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type DeployHost = "vercel" | "railway" | "render" | "fly" | "self-hosted" | "local";

type DeployCheck = {
  id: "database" | "slug" | "domain-free" | "domain-custom" | "live";
  label: string;
  done: boolean;
  hint?: string;
};

type DeployState = {
  host: DeployHost;
  currentHost: string;
  deployHost: string | null;
  isPublic: boolean;
  checks: DeployCheck[];
};

type DeployTarget = {
  id: "vercel" | "railway" | "render" | "self-host";
  name: string;
  tagline: string;
  cost: string;
  rec: boolean;
  ctaUrl: string;
  ctaLabel: string;
};

type Props = {
  state: DeployState;
  liveUrl: string;
  verifiedDomain: string | null;
  targets: DeployTarget[];
  workspaceSlug: string;
  workspaceName: string;
};

export function PublishClient(props: Props) {
  const { state, liveUrl } = props;
  const isLocal = state.host === "local";

  return (
    <div className="space-y-6">
      {/* ── Hero status ──────────────────────────────────────── */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border p-6",
          isLocal
            ? "border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-amber-500/4 to-transparent"
            : "border-emerald-500/30 bg-gradient-to-br from-emerald-500/8 via-emerald-500/4 to-transparent",
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "grid size-12 flex-shrink-0 place-items-center rounded-xl",
              isLocal
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {isLocal ? <WifiOff className="size-5" /> : <Wifi className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">
              {isLocal ? "Tu sitio aún solo se ve en este PC" : "Tu sitio ya está en internet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLocal ? (
                <>
                  CSM está corriendo en{" "}
                  <code className="rounded bg-muted px-1 text-[11px]">localhost</code>. Para que
                  cualquiera del mundo lo vea desde su PC, tienes que subirlo a un servidor real
                  (gratis abajo).
                </>
              ) : (
                <>
                  Está publicado en <strong>{describeHost(state.host)}</strong>. Cualquiera con la
                  URL puede verlo, 24/7. Comparte y a disfrutar.
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyableUrl url={liveUrl} compact />
              {!isLocal && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  En vivo
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Checklist ───────────────────────────────────────── */}
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          Estado de tu publicación
        </h2>
        <ul className="space-y-2">
          {state.checks.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2.5 transition",
                c.done ? "bg-emerald-500/5" : "bg-muted/30",
              )}
            >
              {c.done ? (
                <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm",
                    c.done ? "text-foreground" : "font-medium text-foreground",
                  )}
                >
                  {c.label}
                </p>
                {c.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Plataformas (solo si está local) ─────────────────── */}
      {isLocal && (
        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Rocket className="size-4 text-primary" />
              Sube CSM a un servidor (gratis)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige una plataforma. Te llevamos al sitio donde lo configuras en 1 clic. Tras el
              deploy vuelves aquí y todo lo demás se gestiona desde esta UI.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {props.targets.map((t) => (
              <li
                key={t.id}
                className={cn(
                  "rounded-xl border bg-card p-4 transition hover:shadow-md",
                  t.rec ? "border-primary/40 ring-1 ring-primary/20" : "",
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PlatformIcon id={t.id} />
                    <h3 className="text-sm font-semibold">{t.name}</h3>
                  </div>
                  {t.rec && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <Sparkles className="size-3" />
                      Rec.
                    </span>
                  )}
                </div>
                <p className="mb-1 text-xs text-foreground/80">{t.tagline}</p>
                <p className="mb-3 text-[11px] text-muted-foreground">{t.cost}</p>
                <Button
                  asChild
                  size="sm"
                  variant={t.rec ? "default" : "outline"}
                  className="w-full justify-between gap-1.5"
                >
                  <a href={t.ctaUrl} target="_blank" rel="noreferrer">
                    {t.ctaLabel}
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              </li>
            ))}
          </ul>

          {/* Tip: variables de entorno */}
          <div className="rounded-xl border border-dashed bg-muted/20 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-amber-500" />
              Cuando configures el deploy, copia estos valores
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              La plataforma te pedirá variables de entorno. Estas son las únicas obligatorias —
              copia y pega:
            </p>
            <div className="space-y-1.5">
              <EnvVarRow
                name="DATABASE_URL"
                description="Cadena de conexión a tu Postgres. Crea una en neon.tech (gratis), copia el connection string."
                exampleHref="https://neon.tech/signup"
                exampleLabel="Crear DB en Neon"
              />
              <EnvVarRow
                name="AUTH_SECRET"
                description="Clave aleatoria para sesiones. Genera con `openssl rand -base64 32` o usa el botón."
                generate
              />
              <EnvVarRow
                name="NEXT_PUBLIC_APP_URL"
                description="La URL pública del deploy. Te la da el hosting tras subir."
                placeholder="https://tu-csm.vercel.app"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Dominio propio (siempre visible) ─────────────────── */}
      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Globe className="size-4 text-violet-500" />
              ¿Quieres una URL más bonita?{" "}
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compra tu dominio (~10€/año en Cloudflare/Namecheap) y conéctalo aquí. Tu URL gratis
              sigue funcionando como respaldo.
            </p>
          </div>
        </div>
        {props.verifiedDomain ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <code className="font-mono">{props.verifiedDomain}</code>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Conectado
              </span>
            </div>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/admin/ajustes/dominio">
              <Globe className="size-3.5" />
              Conectar mi dominio
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        )}
      </section>

      {/* ── Si está deployado: extras útiles ─────────────────── */}
      {!isLocal && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Zap className="size-4 text-amber-500" />
            Listo. ¿Y ahora qué?
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 size-3 flex-shrink-0 text-muted-foreground" />
              <span>
                <strong>Comparte tu URL</strong> en redes, email, mensajes — cualquiera del mundo la
                puede abrir.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 size-3 flex-shrink-0 text-muted-foreground" />
              <span>
                <strong>Crea más sitios</strong> con un clic desde el switcher (arriba a la
                izquierda) o en{" "}
                <Link href="/admin/sitios" className="underline">
                  Mis sitios
                </Link>
                .
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 size-3 flex-shrink-0 text-muted-foreground" />
              <span>
                <strong>Conecta un dominio propio</strong> si quieres una URL más profesional
                (arriba).
              </span>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}

function describeHost(h: DeployHost): string {
  switch (h) {
    case "vercel":
      return "Vercel";
    case "railway":
      return "Railway";
    case "render":
      return "Render";
    case "fly":
      return "Fly.io";
    case "self-hosted":
      return "tu servidor";
    case "local":
      return "local";
  }
}

function PlatformIcon({ id }: { id: DeployTarget["id"] }) {
  switch (id) {
    case "vercel":
      return <Cloud className="size-4 text-foreground" />;
    case "railway":
      return <Zap className="size-4 text-foreground" />;
    case "render":
      return <Cloud className="size-4 text-foreground" />;
    case "self-host":
      return <Server className="size-4 text-foreground" />;
  }
}

function CopyableUrl({ url, compact = false }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border bg-background font-mono text-xs",
        compact ? "px-2 py-1" : "px-3 py-2",
      )}
    >
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 truncate hover:text-foreground"
      >
        {url}
      </a>
      <button
        type="button"
        onClick={copy}
        className="ml-1 inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        aria-label="Copiar URL"
      >
        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
      </button>
    </div>
  );
}

function EnvVarRow({
  name,
  description,
  exampleHref,
  exampleLabel,
  generate,
  placeholder,
}: {
  name: string;
  description: string;
  exampleHref?: string;
  exampleLabel?: string;
  generate?: boolean;
  placeholder?: string;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function genSecret() {
    // 32 bytes random → base64. Cumple `AUTH_SECRET min(16)`.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
    setGenerated(btoa(bin).replace(/=+$/, ""));
  }

  async function copyValue(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-lg border bg-background p-2.5 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <code className="font-mono text-[11px] font-semibold">{name}</code>
        <div className="flex items-center gap-1">
          {generate && (
            <button
              type="button"
              onClick={genSecret}
              className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary hover:bg-primary/10"
            >
              Generar
            </button>
          )}
          {exampleHref && exampleLabel && (
            <a
              href={exampleHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary hover:bg-primary/10"
            >
              {exampleLabel}
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
      </div>
      <p className="mb-2 text-muted-foreground">{description}</p>
      {generated && (
        <div className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5 font-mono text-[10px]">
          <span className="min-w-0 flex-1 truncate">{generated}</span>
          <button
            type="button"
            onClick={() => copyValue(generated)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label="Copiar"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          </button>
        </div>
      )}
      {placeholder && !generated && (
        <p className="font-mono text-[10px] text-muted-foreground/70">e.g. {placeholder}</p>
      )}
    </div>
  );
}
