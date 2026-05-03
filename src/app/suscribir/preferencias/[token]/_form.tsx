"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { updatePreferencesAction } from "../../_actions";

export function PreferencesForm({ token, initialTags }: { token: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function addTag() {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return setDraft("");
    setTags([...tags, t]);
    setDraft("");
  }
  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await updatePreferencesAction({ token, tags });
      setSaved(result.ok);
      if (!result.ok) {
        // eslint-disable-next-line no-alert
        alert("No pudimos guardar las preferencias.");
      }
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={onSubmit}>
      <div>
        <p className="mb-2 text-sm font-medium">Etiquetas</p>
        <p className="mb-3 text-xs text-[color:var(--th-fg-muted)]">
          Las etiquetas te suscriben a contenidos específicos. Añade las que te interesen.
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-[var(--th-radius-pill)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-3 py-1 text-sm"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                className="text-[color:var(--th-fg-muted)] hover:text-rose-500"
                aria-label={`Quitar etiqueta ${t}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {tags.length === 0 ? (
            <span className="text-sm text-[color:var(--th-fg-subtle)]">Sin etiquetas todavía</span>
          ) : null}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="añade una etiqueta y pulsa Enter"
            className="flex-1 rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--th-brand)]"
          />
          <button
            type="button"
            onClick={addTag}
            className="rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] px-4 text-sm hover:border-[color:var(--th-brand)]"
          >
            Añadir
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[color:var(--th-border)] pt-4">
        <a
          href="../../baja"
          className="text-sm text-rose-500 underline-offset-4 hover:underline"
          aria-label="Cancelar suscripción totalmente"
        >
          Cancelar suscripción
        </a>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--th-radius-md)] bg-[color:var(--th-brand)] px-5 py-2.5 text-sm font-medium text-[color:var(--th-brand-fg)] hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : null}
          {saved ? "Guardado" : pending ? "Guardando…" : "Guardar preferencias"}
        </button>
      </div>
    </form>
  );
}
