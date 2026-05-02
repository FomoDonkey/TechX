"use client";

import { FieldRenderer, buildDefaultValues } from "@/components/forms/field-renderer";
import { Button } from "@/components/ui/button";
import { isVisible } from "@/forms/conditional";
import type { Field, FormSchema } from "@/forms/types";
import { isInputField } from "@/forms/types";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PublicSettings = {
  honeypotFieldName: string;
  minSubmitTimeMs: number;
  captcha?: { provider: "hcaptcha" | "turnstile"; siteKey: string };
  doubleOptIn: boolean;
};

type FormState = "editing" | "submitting" | "success" | "needs_confirmation" | "error";

export function PublicFormClient({
  slug,
  schema,
  publicSettings,
  successMessage,
  redirectUrl,
}: {
  slug: string;
  schema: FormSchema;
  publicSettings: PublicSettings;
  successMessage: string | null;
  redirectUrl: string | null;
}) {
  const [data, setData] = useState<Record<string, unknown>>(() =>
    buildDefaultValues(schema.fields),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<FormState>("editing");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const loadedAtRef = useRef<number>(Date.now());
  const honeypotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadedAtRef.current = Date.now();
  }, []);

  const steps =
    schema.steps.length > 0
      ? schema.steps
      : [{ id: "single", fieldIds: schema.fields.map((f) => f.id) }];
  const currentStep = steps[stepIdx];
  const fieldsInStep = useMemo(
    () =>
      (currentStep?.fieldIds ?? [])
        .map((fid) => schema.fields.find((f) => f.id === fid))
        .filter((f): f is Field => Boolean(f)),
    [currentStep, schema.fields],
  );

  function setField(key: string, v: unknown) {
    setData((d) => ({ ...d, [key]: v }));
    if (errors[key]) {
      setErrors((e) => {
        const { [key]: _, ...rest } = e;
        return rest;
      });
    }
  }

  function validateStep(): boolean {
    const next: Record<string, string> = {};
    for (const f of fieldsInStep) {
      if (!isInputField(f)) continue;
      const visible = isVisible(("visibleIf" in f && f.visibleIf) || undefined, data);
      if (!visible) continue;
      const v = data[f.key];
      const required = "required" in f && f.required;
      const isMissing =
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (f.type === "checkbox" && v === false);
      if (required && isMissing) next[f.key] = "Este campo es obligatorio";
    }
    setErrors((e) => ({ ...e, ...next }));
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }
  function prevStep() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep()) return;
    setState("submitting");
    setErrorMsg(null);

    const payload: Record<string, unknown> = {
      ...data,
      csm_t: loadedAtRef.current,
    };
    payload[publicSettings.honeypotFieldName] = honeypotRef.current?.value ?? "";

    try {
      const res = await fetch(`/api/public/forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        needsConfirmation?: boolean;
        redirectUrl?: string;
        error?: { code?: string; message?: string; issues?: { path: string; message: string }[] };
      };
      if (!res.ok) {
        if (json.error?.code === "validation_error" && json.error.issues) {
          const next: Record<string, string> = {};
          for (const i of json.error.issues) next[i.path] = i.message;
          setErrors(next);
          setState("editing");
          return;
        }
        setErrorMsg(json.error?.message ?? `Error ${res.status}`);
        setState("error");
        return;
      }
      if (json.redirectUrl ?? redirectUrl) {
        window.location.href = (json.redirectUrl ?? redirectUrl)!;
        return;
      }
      setResultMsg(json.message ?? successMessage ?? "¡Gracias!");
      if (json.needsConfirmation || publicSettings.doubleOptIn) {
        setState("needs_confirmation");
      } else {
        setState("success");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error de red");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <Result icon="success" title="¡Recibido!" message={resultMsg ?? "Gracias por tu envío."} />
    );
  }
  if (state === "needs_confirmation") {
    return (
      <Result
        icon="mail"
        title="Confirma en tu email"
        message={resultMsg ?? "Te hemos enviado un email para confirmar."}
      />
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-6 space-y-4">
      {steps.length > 1 ? (
        <ProgressBar current={stepIdx} total={steps.length} title={currentStep?.title} />
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        {fieldsInStep.map((f) => {
          if (!isInputField(f)) {
            return (
              <FieldRenderer
                key={f.id}
                field={f}
                value={undefined}
                onChange={() => {}}
                data={data}
              />
            );
          }
          return (
            <FieldRenderer
              key={f.id}
              field={f}
              value={data[f.key]}
              onChange={(v) => setField(f.key, v)}
              data={data}
              error={errors[f.key]}
              disabled={state === "submitting"}
            />
          );
        })}
      </div>

      {/* Honeypot — invisible para humanos */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", opacity: 0 }}>
        <label>
          No rellenar
          <input
            ref={honeypotRef}
            type="text"
            name={publicSettings.honeypotFieldName}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
          {errorMsg}
        </div>
      ) : null}

      <div className="flex justify-between gap-2 pt-2">
        {steps.length > 1 && stepIdx > 0 ? (
          <Button type="button" variant="ghost" onClick={prevStep} className="gap-1.5">
            <ArrowLeft className="size-3.5" /> Anterior
          </Button>
        ) : (
          <span />
        )}
        {steps.length > 1 && stepIdx < steps.length - 1 ? (
          <Button type="button" onClick={nextStep} className="gap-1.5">
            Siguiente <ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <Button type="submit" disabled={state === "submitting"} className="gap-1.5">
            {state === "submitting" ? "Enviando…" : (schema.submitLabel ?? "Enviar")}
          </Button>
        )}
      </div>
    </form>
  );
}

function ProgressBar({
  current,
  total,
  title,
}: { current: number; total: number; title?: string }) {
  const pct = ((current + 1) / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Paso {current + 1} de {total}
        </span>
        {title ? <span className="font-medium">{title}</span> : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-pink-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Result({
  icon,
  title,
  message,
}: { icon: "success" | "mail"; title: string; message: string }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-500/15">
        {icon === "success" ? (
          <CheckCircle2 className="size-8 text-green-500" />
        ) : (
          <span className="text-3xl">📨</span>
        )}
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
