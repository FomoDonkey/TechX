"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unsubscribeAction } from "../../_actions";

const REASONS = [
  "Recibo demasiados emails",
  "El contenido no es relevante",
  "Nunca me suscribí",
  "Otro motivo",
];

export function UnsubscribeForm({ token }: { token: string }) {
  const [reason, setReason] = useState<string>("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await unsubscribeAction({ token, reason: reason || undefined });
      if (result.ok) {
        router.replace("?confirmed=1");
      }
    });
  }

  return (
    <form className="mt-8 space-y-3" onSubmit={onSubmit}>
      <fieldset className="space-y-2">
        <legend className="text-sm text-[color:var(--th-fg-muted)]">
          ¿Quieres contarnos el motivo? (opcional)
        </legend>
        {REASONS.map((r) => (
          <label
            key={r}
            className="flex items-center gap-3 rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] p-3 hover:border-[color:var(--th-brand)]"
          >
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={(e) => setReason(e.currentTarget.value)}
              className="size-4 accent-[color:var(--th-brand)]"
            />
            <span className="text-sm">{r}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:justify-end">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] px-5 py-3 font-medium"
        >
          Cancelar
        </a>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--th-radius-md)] bg-rose-500 px-5 py-3 font-medium text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {pending ? "Procesando…" : "Sí, cancelar suscripción"}
        </button>
      </div>
    </form>
  );
}
