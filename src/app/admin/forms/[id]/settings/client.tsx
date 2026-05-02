"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormSettings } from "@/forms/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { archiveFormAction, deleteFormAction, updateFormAction } from "../../_actions";

export function SettingsClient({
  formId,
  initial,
}: {
  formId: string;
  initial: {
    name: string;
    slug: string;
    description: string;
    notificationEmails: string[];
    successMessage: string;
    redirectUrl: string;
    settings: FormSettings;
  };
}) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [description, setDescription] = useState(initial.description);
  const [notificationEmails, setNotificationEmails] = useState(
    initial.notificationEmails.join(", "),
  );
  const [successMessage, setSuccessMessage] = useState(initial.successMessage);
  const [redirectUrl, setRedirectUrl] = useState(initial.redirectUrl);
  const [doubleOptIn, setDoubleOptIn] = useState(Boolean(initial.settings.doubleOptIn));
  const [storeIp, setStoreIp] = useState(initial.settings.storeIp !== false);
  const [allowedOrigins, setAllowedOrigins] = useState(
    (initial.settings.allowedOrigins ?? []).join(", "),
  );
  const [perIpHourly, setPerIpHourly] = useState(initial.settings.perIpHourly ?? 20);
  const [perIpDaily, setPerIpDaily] = useState(initial.settings.perIpDaily ?? 100);
  const [minSubmitTimeMs, setMinSubmitTimeMs] = useState(initial.settings.minSubmitTimeMs ?? 1500);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const emails = notificationEmails
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const origins = allowedOrigins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const newSettings: FormSettings = {
        ...initial.settings,
        doubleOptIn,
        storeIp,
        allowedOrigins: origins.length > 0 ? origins : undefined,
        perIpHourly,
        perIpDaily,
        minSubmitTimeMs,
      };
      const r = await updateFormAction({
        id: formId,
        name,
        slug,
        description,
        notificationEmails: emails,
        successMessage: successMessage || null,
        redirectUrl: redirectUrl || null,
        settings: newSettings,
      });
      if (r.ok) toast.success("Guardado");
      else toast.error(r.error ?? "Error");
    });
  }

  function archive() {
    if (!confirm("Archivar este formulario? Dejará de aceptar envíos públicos.")) return;
    start(async () => {
      const r = await archiveFormAction(formId);
      if (r.ok) {
        toast.success("Archivado");
        router.push("/admin/forms");
      } else toast.error(r.error);
    });
  }

  function destroy() {
    if (!confirm("Eliminar formulario y TODAS sus submissions? Esto no se puede deshacer.")) return;
    if (!confirm("¿Estás seguro?")) return;
    start(async () => {
      const r = await deleteFormAction(formId);
      if (r.ok) {
        toast.success("Eliminado");
        router.push("/admin/forms");
      } else toast.error(r.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-6">
      <Section title="General">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Slug">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="font-mono"
            />
          </Field>
        </div>
        <Field label="Descripción interna">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </Section>

      <Section title="Tras envío">
        <Field label="Mensaje de éxito">
          <Textarea
            value={successMessage}
            onChange={(e) => setSuccessMessage(e.target.value)}
            rows={2}
            placeholder="¡Gracias por tu envío!"
          />
        </Field>
        <Field label="Redirigir a (opcional)">
          <Input
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
            placeholder="https://..."
          />
        </Field>
      </Section>

      <Section title="Notificaciones">
        <Field label="Emails que reciben aviso (separados por coma)">
          <Input
            value={notificationEmails}
            onChange={(e) => setNotificationEmails(e.target.value)}
            placeholder="ana@ejemplo.com, lu@ejemplo.com"
          />
        </Field>
      </Section>

      <Section title="Anti-spam y seguridad">
        <Toggle
          checked={doubleOptIn}
          onChange={setDoubleOptIn}
          label="Doble opt-in"
          help="Envía un email de confirmación al primer field email detectado. La submission queda pendiente hasta que confirma."
        />
        <Toggle
          checked={storeIp}
          onChange={setStoreIp}
          label="Guardar hash de IP"
          help="Útil para rate limit y deduplicación. Hash sha-256, no IP en claro."
        />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tiempo mín. submit (ms)">
            <Input
              type="number"
              min={0}
              max={60000}
              value={minSubmitTimeMs}
              onChange={(e) => setMinSubmitTimeMs(Number(e.target.value))}
            />
          </Field>
          <Field label="Límite/hora por IP">
            <Input
              type="number"
              min={1}
              value={perIpHourly}
              onChange={(e) => setPerIpHourly(Number(e.target.value))}
            />
          </Field>
          <Field label="Límite/día por IP">
            <Input
              type="number"
              min={1}
              value={perIpDaily}
              onChange={(e) => setPerIpDaily(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Orígenes permitidos (CORS, separados por coma)">
          <Input
            value={allowedOrigins}
            onChange={(e) => setAllowedOrigins(e.target.value)}
            placeholder="https://misitio.com, https://otra.com — vacío = público"
          />
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>

      <Section title="Zona de peligro" tone="danger">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={archive} disabled={pending}>
            Archivar formulario
          </Button>
          <Button variant="destructive" onClick={destroy} disabled={pending}>
            Eliminar formulario
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section
      className={`rounded-2xl border p-5 space-y-4 ${tone === "danger" ? "border-rose-500/30 bg-rose-500/5" : "bg-card/30"}`}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
  help?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/20">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded"
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {help ? <p className="text-[11px] text-muted-foreground mt-0.5">{help}</p> : null}
      </div>
    </label>
  );
}
