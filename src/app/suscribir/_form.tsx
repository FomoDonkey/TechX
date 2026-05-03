"use client";

import { Check, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; needsConfirmation: boolean; message: string }
  | { kind: "err"; message: string };

export function SubscribeForm({ workspaceId }: { workspaceId: string | null }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const formLoadedAtRef = useRef<number>(0);

  useEffect(() => {
    formLoadedAtRef.current = Date.now();
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "loading") return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const honeypot = String(formData.get("website") ?? "").trim();

    if (!email || !email.includes("@")) {
      setStatus({ kind: "err", message: "Introduce un email válido" });
      return;
    }

    setStatus({ kind: "loading" });
    startTransition(async () => {
      try {
        const res = await fetch("/api/public/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name: name || undefined,
            workspaceId: workspaceId ?? undefined,
            website: honeypot,
            csm_t: formLoadedAtRef.current,
            source: "public_form",
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          needsConfirmation?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          if (data.error === "rate_limited") {
            setStatus({ kind: "err", message: "Demasiados intentos. Vuelve en una hora." });
          } else if (data.error === "invalid_email") {
            setStatus({ kind: "err", message: "Email inválido." });
          } else {
            setStatus({ kind: "err", message: "No se pudo procesar. Inténtalo más tarde." });
          }
          return;
        }
        setStatus({
          kind: "ok",
          needsConfirmation: !!data.needsConfirmation,
          message: data.message ?? (data.needsConfirmation ? "Revisa tu email" : "¡Suscrito!"),
        });
        form.reset();
      } catch {
        setStatus({ kind: "err", message: "Sin conexión. Reintenta." });
      }
    });
  }

  if (status.kind === "ok") {
    return (
      // biome-ignore lint/a11y/useSemanticElements: <output> tiene semántica de "form result" pero queremos también layout.
      <div
        role="status"
        className="flex flex-col items-center gap-2 rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-6 text-center"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-[color:var(--th-brand)]/15 text-[color:var(--th-brand)]">
          <Check className="size-5" />
        </span>
        <p className="font-medium">{status.message}</p>
        {status.needsConfirmation ? (
          <p className="text-sm text-[color:var(--th-fg-muted)]">
            Te hemos enviado un email para confirmar tu suscripción. Si no lo ves en unos minutos,
            revisa tu carpeta de spam.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit} aria-label="Formulario de suscripción">
      <input
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] -top-[9999px] size-0 opacity-0"
      />
      <label htmlFor="subscribe-name" className="sr-only">
        Nombre (opcional)
      </label>
      <input
        id="subscribe-name"
        name="name"
        type="text"
        autoComplete="given-name"
        placeholder="Tu nombre (opcional)"
        className="w-full rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-4 py-3 text-[color:var(--th-fg)] outline-none placeholder:text-[color:var(--th-fg-subtle)] focus:border-[color:var(--th-brand)] focus:ring-2 focus:ring-[color:var(--th-ring)]"
      />
      <label htmlFor="subscribe-email" className="sr-only">
        Email
      </label>
      <input
        id="subscribe-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="tu@email.com"
        className="w-full rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-4 py-3 text-[color:var(--th-fg)] outline-none placeholder:text-[color:var(--th-fg-subtle)] focus:border-[color:var(--th-brand)] focus:ring-2 focus:ring-[color:var(--th-ring)]"
      />
      <button
        type="submit"
        disabled={status.kind === "loading"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--th-radius-md)] bg-[color:var(--th-brand)] px-4 py-3 font-medium text-[color:var(--th-brand-fg)] transition hover:opacity-90 disabled:opacity-60"
      >
        {status.kind === "loading" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <Send className="size-4" />
            Suscribirme
          </>
        )}
      </button>
      {status.kind === "err" ? (
        <p className="text-center text-sm text-rose-500" role="alert">
          {status.message}
        </p>
      ) : null}
      <p className="text-center text-xs text-[color:var(--th-fg-subtle)]">
        Te enviaremos un email para confirmar la suscripción.
      </p>
    </form>
  );
}
