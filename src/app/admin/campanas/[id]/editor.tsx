"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Campaign, Segment } from "@/db/schema";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Globe,
  Loader2,
  Monitor,
  Save,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  deleteCampaignAction,
  sendCampaignAction,
  sendTestCampaignAction,
  updateCampaignAction,
} from "../_actions";

type Stats = {
  total: number;
  sent: number;
  pending: number;
  sending: number;
  bounced: number;
  failed: number;
  opened: number;
  clicked: number;
} | null;

export function CampaignEditor({
  campaign,
  segments,
  stats,
}: {
  campaign: Campaign;
  segments: Segment[];
  stats: Stats;
}) {
  const router = useRouter();
  const isLocked = campaign.status === "sending" || campaign.status === "sent";
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [preheader, setPreheader] = useState(campaign.previewText ?? "");
  const [fromName, setFromName] = useState(campaign.fromName ?? "");
  const [fromEmail, setFromEmail] = useState(campaign.fromEmail ?? "");
  const [bodyHtml, setBodyHtml] = useState(campaign.bodyHtml ?? "");
  const [segmentId, setSegmentId] = useState<string | null>(campaign.segmentId);
  const [scheduledAt, setScheduledAt] = useState<string>(
    campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : "",
  );
  const [tab, setTab] = useState<"design" | "settings" | "analytics">("design");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isDirty = useMemo(() => {
    return (
      name !== campaign.name ||
      subject !== campaign.subject ||
      preheader !== (campaign.previewText ?? "") ||
      fromName !== (campaign.fromName ?? "") ||
      fromEmail !== (campaign.fromEmail ?? "") ||
      bodyHtml !== (campaign.bodyHtml ?? "") ||
      segmentId !== campaign.segmentId ||
      scheduledAt !==
        (campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : "")
    );
  }, [name, subject, preheader, fromName, fromEmail, bodyHtml, segmentId, scheduledAt, campaign]);

  // Autosave debounced
  useEffect(() => {
    if (!isDirty || isLocked) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startSave(async () => {
        await updateCampaignAction({
          id: campaign.id,
          patch: {
            name,
            subject,
            previewText: preheader || null,
            fromName: fromName || null,
            fromEmail: fromEmail || null,
            bodyHtml,
            segmentId,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          },
        });
        setSavedAt(new Date());
      });
    }, 1200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    isDirty,
    isLocked,
    name,
    subject,
    preheader,
    fromName,
    fromEmail,
    bodyHtml,
    segmentId,
    scheduledAt,
    campaign.id,
  ]);

  function handleSendTest() {
    if (!testEmail.includes("@")) return;
    setTestStatus("sending");
    startSend(async () => {
      const r = await sendTestCampaignAction({ id: campaign.id, email: testEmail });
      setTestStatus(r.ok ? "ok" : "err");
      setTimeout(() => setTestStatus("idle"), 4000);
    });
  }

  function handleSendNow() {
    if (!confirm("Enviar campaña a la audiencia seleccionada AHORA. ¿Confirmar?")) return;
    startSend(async () => {
      const r = await sendCampaignAction({ id: campaign.id });
      if (r.ok) {
        router.refresh();
      } else {
        alert("No se pudo enviar.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Eliminar esta campaña?")) return;
    startSend(async () => {
      await deleteCampaignAction({ id: campaign.id });
      router.push("/admin/campanas");
    });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex items-center gap-3 border-b bg-card/30 px-6 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/campanas">
            <ArrowLeft className="mr-1.5 size-4" />
            Volver
          </Link>
        </Button>
        <div className="flex-1 truncate">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLocked}
            className="h-8 max-w-md border-none bg-transparent text-sm font-medium shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Guardando…
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-500" />
              Guardado {timeAgo(savedAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-muted p-0.5 text-xs">
          {(["design", "settings", "analytics"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 ${tab === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {t === "design" ? "Diseño" : t === "settings" ? "Ajustes" : "Analítica"}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="text-rose-500" onClick={handleDelete}>
          <Trash2 className="size-4" />
        </Button>
        <Button onClick={handleSendNow} disabled={isLocked || sending}>
          {sending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 size-4" />
          )}
          Enviar ahora
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {tab === "design" ? (
          <DesignTab
            subject={subject}
            preheader={preheader}
            bodyHtml={bodyHtml}
            device={device}
            isLocked={isLocked}
            onSubject={setSubject}
            onPreheader={setPreheader}
            onBodyHtml={setBodyHtml}
            onDevice={setDevice}
          />
        ) : null}
        {tab === "settings" ? (
          <SettingsTab
            fromName={fromName}
            fromEmail={fromEmail}
            segmentId={segmentId}
            scheduledAt={scheduledAt}
            segments={segments}
            isLocked={isLocked}
            testEmail={testEmail}
            testStatus={testStatus}
            onFromName={setFromName}
            onFromEmail={setFromEmail}
            onSegmentId={setSegmentId}
            onScheduledAt={setScheduledAt}
            onTestEmail={setTestEmail}
            onSendTest={handleSendTest}
          />
        ) : null}
        {tab === "analytics" ? <AnalyticsTab campaign={campaign} stats={stats} /> : null}
      </div>
    </div>
  );
}

function DesignTab({
  subject,
  preheader,
  bodyHtml,
  device,
  isLocked,
  onSubject,
  onPreheader,
  onBodyHtml,
  onDevice,
}: {
  subject: string;
  preheader: string;
  bodyHtml: string;
  device: "desktop" | "mobile";
  isLocked: boolean;
  onSubject: (v: string) => void;
  onPreheader: (v: string) => void;
  onBodyHtml: (v: string) => void;
  onDevice: (v: "desktop" | "mobile") => void;
}) {
  return (
    <div className="grid w-full grid-cols-1 lg:grid-cols-2">
      <section className="flex flex-col overflow-y-auto border-r p-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Composer
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" htmlFor="cmp-subject">
              Asunto
            </label>
            <Input
              id="cmp-subject"
              value={subject}
              onChange={(e) => onSubject(e.target.value)}
              disabled={isLocked}
              placeholder="✦ Lo nuevo de este mes"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" htmlFor="cmp-pre">
              Preheader (texto previo)
            </label>
            <Input
              id="cmp-pre"
              value={preheader}
              onChange={(e) => onPreheader(e.target.value)}
              disabled={isLocked}
              placeholder="Un resumen muy breve del email…"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" htmlFor="cmp-body">
              Cuerpo HTML
            </label>
            <textarea
              id="cmp-body"
              value={bodyHtml}
              onChange={(e) => onBodyHtml(e.target.value)}
              disabled={isLocked}
              rows={20}
              placeholder={
                '<h2>¡Hola!</h2>\n<p>Este es el cuerpo del email…</p>\n<p><a href="https://example.com">Ver online →</a></p>'
              }
              className="w-full rounded-md border bg-background p-3 font-mono text-xs disabled:opacity-60"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Tags permitidos: a, p, h1-h4, ul/ol/li, strong/em, blockquote, img, table. Inline
              styles OK. Enlaces se reescriben para tracking.
            </p>
          </div>
        </div>
      </section>
      <section className="flex flex-col overflow-y-auto bg-muted/10 p-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </h2>
          <span className="ml-auto" />
          <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onDevice("desktop")}
              className={`rounded-full p-1.5 ${device === "desktop" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              aria-label="Desktop"
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDevice("mobile")}
              className={`rounded-full p-1.5 ${device === "mobile" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              aria-label="Mobile"
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>
        </div>
        <div
          className={cn(
            "mx-auto rounded-2xl border bg-[#0c0a14] shadow-xl transition-all",
            device === "desktop" ? "w-full max-w-2xl" : "w-[380px]",
          )}
        >
          <div className="border-b border-white/10 px-6 py-3">
            <p className="text-xs text-white/50">Asunto</p>
            <p className="text-sm font-medium text-white">{subject || "(sin asunto)"}</p>
            {preheader ? <p className="mt-1 text-xs text-white/40">{preheader}</p> : null}
          </div>
          <div
            className="prose-invert min-h-[400px] p-6 text-sm text-white/90"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: preview cliente — admin own content, no untrusted
            dangerouslySetInnerHTML={{
              __html: bodyHtml || "<p style='color:#666'>Empieza a escribir tu campaña…</p>",
            }}
          />
        </div>
      </section>
    </div>
  );
}

function SettingsTab({
  fromName,
  fromEmail,
  segmentId,
  scheduledAt,
  segments,
  isLocked,
  testEmail,
  testStatus,
  onFromName,
  onFromEmail,
  onSegmentId,
  onScheduledAt,
  onTestEmail,
  onSendTest,
}: {
  fromName: string;
  fromEmail: string;
  segmentId: string | null;
  scheduledAt: string;
  segments: Segment[];
  isLocked: boolean;
  testEmail: string;
  testStatus: "idle" | "sending" | "ok" | "err";
  onFromName: (v: string) => void;
  onFromEmail: (v: string) => void;
  onSegmentId: (v: string | null) => void;
  onScheduledAt: (v: string) => void;
  onTestEmail: (v: string) => void;
  onSendTest: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto p-6">
      <Section title="Remitente">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium" htmlFor="cmp-from-name">
              Nombre
            </label>
            <Input
              id="cmp-from-name"
              value={fromName}
              onChange={(e) => onFromName(e.target.value)}
              disabled={isLocked}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" htmlFor="cmp-from-email">
              Email
            </label>
            <Input
              id="cmp-from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => onFromEmail(e.target.value)}
              disabled={isLocked}
              placeholder="hola@dominio.com"
            />
          </div>
        </div>
      </Section>

      <Section title="Audiencia" icon={<Users className="size-4" />}>
        <select
          value={segmentId ?? ""}
          onChange={(e) => onSegmentId(e.target.value || null)}
          disabled={isLocked}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todos los suscriptores activos confirmados</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted-foreground">
          Sin segmento: enviamos a todos. Crea uno en{" "}
          <Link href="/admin/segmentos" className="underline">
            Segmentos
          </Link>{" "}
          para audiencias específicas.
        </p>
      </Section>

      <Section title="Programación">
        <Input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAt(e.target.value)}
          disabled={isLocked}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Vacío = quedará en borrador hasta que pulses <strong>Enviar ahora</strong>.
        </p>
      </Section>

      <Section title="Enviar email de prueba" icon={<Sparkles className="size-4" />}>
        <div className="flex gap-2">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => onTestEmail(e.target.value)}
            placeholder="prueba@email.com"
          />
          <Button type="button" onClick={onSendTest} disabled={testStatus === "sending"}>
            {testStatus === "sending" ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 size-4" />
            )}
            Enviar
          </Button>
        </div>
        {testStatus === "ok" ? (
          <p className="mt-2 text-xs text-emerald-500">
            Email enviado (o registrado en mock si no hay Resend).
          </p>
        ) : null}
        {testStatus === "err" ? (
          <p className="mt-2 text-xs text-rose-500">No se pudo enviar.</p>
        ) : null}
      </Section>
    </div>
  );
}

function AnalyticsTab({ campaign, stats }: { campaign: Campaign; stats: Stats }) {
  if (!stats || stats.total === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl items-center justify-center p-12">
        <div className="text-center">
          <Eye className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Las métricas aparecerán aquí cuando la campaña se envíe.
          </p>
        </div>
      </div>
    );
  }
  const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
  const clickRate = stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 overflow-y-auto p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Enviados" value={stats.sent} />
        <Stat label="Aperturas" value={stats.opened} suffix={`${openRate}%`} highlight />
        <Stat label="Clicks" value={stats.clicked} suffix={`${clickRate}%`} highlight />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pendientes" value={stats.pending} />
        <Stat label="Enviando" value={stats.sending} />
        <Stat label="Bounces" value={stats.bounced} />
        <Stat label="Errores" value={stats.failed} />
      </div>
      <div className="rounded-2xl border bg-card/30 p-5 text-sm">
        <p className="font-medium">Estado de la campaña</p>
        <p className="mt-2 text-muted-foreground">
          {campaign.status === "sent"
            ? `Completada · ${campaign.sentAt ? new Date(campaign.sentAt).toLocaleString() : ""}`
            : campaign.status === "sending"
              ? "En envío…"
              : campaign.status === "scheduled"
                ? `Programada para ${campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : ""}`
                : "Borrador"}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card/30 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card/30 p-4",
        highlight && "border-[color:var(--th-brand,#9b5cff)]/40",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {suffix ? <p className="text-xs text-muted-foreground">{suffix}</p> : null}
    </div>
  );
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 5_000) return "ahora";
  if (diff < 60_000) return `hace ${Math.floor(diff / 1000)}s`;
  if (diff < 3600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  return d.toLocaleTimeString();
}
