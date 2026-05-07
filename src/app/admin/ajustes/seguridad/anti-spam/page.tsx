import { getCurrentUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAntiBotStatus, resolveAntiBotProvider } from "@/lib/anti-bot";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Anti-spam · techx" };
export const dynamic = "force-dynamic";

export default async function AntiSpamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const status = getAntiBotStatus();
  const active = resolveAntiBotProvider();

  const providers: Array<{
    id: "botid" | "turnstile" | "hcaptcha";
    name: string;
    description: string;
    envHint: string;
    docHref: string;
    active: boolean;
  }> = [
    {
      id: "botid",
      name: "Vercel BotID",
      description:
        "Detección platform-native sin captcha visible. Detecta navegadores headless, automatización y patrones de tráfico bot. Requiere instalar @vercel/botid y desplegar en Vercel.",
      envHint: "VERCEL_BOTID_ENABLED=1 + npm i @vercel/botid",
      docHref: "https://vercel.com/docs/security/botid",
      active: status.botid,
    },
    {
      id: "turnstile",
      name: "Cloudflare Turnstile",
      description:
        "Captcha invisible con UI mínima. Free, sin tracking de Google. Verifica un token enviado en `csm_captcha`.",
      envHint: "TURNSTILE_SECRET=0x... + TURNSTILE_SITE_KEY=0x... (cliente)",
      docHref: "https://developers.cloudflare.com/turnstile/",
      active: status.turnstile,
    },
    {
      id: "hcaptcha",
      name: "hCaptcha",
      description:
        'Captcha clásico tipo "selecciona los semáforos". Más visible pero amplia compatibilidad.',
      envHint: "HCAPTCHA_SECRET=ES_... + HCAPTCHA_SITE_KEY=...",
      docHref: "https://www.hcaptcha.com/",
      active: status.hcaptcha,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Anti-spam</h1>
        <p className="text-sm text-muted-foreground">
          Protección contra bots y spam en endpoints públicos: forms, comentarios y newsletter.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-lg ${
              active === "none"
                ? "bg-amber-500/15 text-amber-500"
                : "bg-emerald-500/15 text-emerald-500"
            }`}
          >
            {active === "none" ? (
              <ShieldAlert className="size-5" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="font-medium">
              Provider activo:{" "}
              <Badge variant={active === "none" ? "outline" : "default"} className="ml-2">
                {active === "none" ? "Sólo honeypot + rate-limit" : active}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground">
              {active === "none" ? (
                <>
                  Estás defendido por <strong>honeypot field</strong>, <strong>time-trap</strong> y{" "}
                  <strong>rate-limit por IP</strong>. Para producción con tráfico orgánico
                  recomendamos añadir Turnstile o BotID — son free y cierran el 95% del spam
                  automatizado.
                </>
              ) : (
                <>
                  Cada submission de form/comentario/newsletter se valida contra{" "}
                  <strong>{active}</strong> antes de procesarse. Si el token falla o falta cuando el
                  provider está activo, el endpoint responde 200 silencioso para no delatar al bot.
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Providers disponibles</h2>
        <div className="space-y-3">
          {providers.map((p) => (
            <Card key={p.id} className="space-y-2 p-5">
              <div className="flex items-center gap-3">
                <h3 className="font-medium">{p.name}</h3>
                <Badge variant={p.active ? "default" : "outline"}>
                  {p.active ? "Configurado" : "Inactivo"}
                </Badge>
                {active === p.id && (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    En uso
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <code className="rounded bg-muted px-2 py-1 font-mono">{p.envHint}</code>
                <a
                  href={p.docHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:underline"
                >
                  Documentación →
                </a>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Defensas siempre activas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">Honeypot</p>
            <p className="text-xs text-muted-foreground">
              Campo invisible (<code>website</code>, <code>hp</code>) que sólo bots rellenan.
              Submission se descarta silenciosamente.
            </p>
          </Card>
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">Time-trap</p>
            <p className="text-xs text-muted-foreground">
              Campo <code>csm_t</code> con timestamp de carga del form. Si el envío llega &lt; 800ms
              después es bot.
            </p>
          </Card>
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">Rate-limit por IP</p>
            <p className="text-xs text-muted-foreground">
              Token bucket por IP+endpoint. 8/h y 40/d en newsletter; configurable por form.
            </p>
          </Card>
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">AI moderation</p>
            <p className="text-xs text-muted-foreground">
              Scoring heurístico + LLM que clasifica comentarios. El umbral de auto-spam se
              configura por workspace.
            </p>
          </Card>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        <Link href="/admin/ajustes/seguridad" className="hover:underline">
          ← Volver al centro de seguridad
        </Link>
      </p>
    </div>
  );
}
