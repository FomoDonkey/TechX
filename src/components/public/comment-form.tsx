"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

export function CommentForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage(null);
    try {
      const r = await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, authorName: name, authorEmail: email, body, hp }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: "approved" | "pending" | "spam";
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setStatus("error");
        setMessage(j.error ?? "No se pudo enviar.");
        return;
      }
      setStatus("ok");
      if (j.status === "approved") setMessage("¡Gracias! Tu comentario ya está publicado.");
      else if (j.status === "pending")
        setMessage("Gracias. Tu comentario está pendiente de moderación.");
      else setMessage("Gracias. Revisaremos tu comentario.");
      setName("");
      setEmail("");
      setBody("");
    } catch {
      setStatus("error");
      setMessage("Error de red. Inténtalo más tarde.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-[var(--th-radius-lg)] border border-[color:var(--th-border)] bg-[color:var(--th-surface)] p-6">
        <p className="text-sm text-[color:var(--th-fg)]">{message}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-3 text-xs underline text-[color:var(--th-fg-muted)]"
        >
          Dejar otro comentario
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--th-radius-lg)] border border-[color:var(--th-border)] bg-[color:var(--th-surface)] p-6"
    >
      <h3 className="text-base font-semibold">Deja un comentario</h3>
      <p className="mt-1 text-xs text-[color:var(--th-fg-subtle)]">
        Tu email no se publicará. Aplicamos moderación con IA contra spam.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          required
          minLength={1}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--th-brand)]"
        />
        <input
          required
          type="email"
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (no se publica)"
          className="rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--th-brand)]"
        />
      </div>
      <textarea
        required
        minLength={2}
        maxLength={5000}
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Tu comentario…"
        className="mt-3 block w-full rounded-[var(--th-radius-md)] border border-[color:var(--th-border)] bg-[color:var(--th-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--th-brand)]"
      />
      {/* Honeypot anti-bot, oculto */}
      <input
        type="text"
        name="hp"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[color:var(--th-fg-subtle)]">{body.length} / 5000</p>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center gap-2 rounded-[var(--th-radius-pill)] bg-[color:var(--th-brand)] px-4 py-2 text-sm font-medium text-[color:var(--th-brand-fg)] shadow-[var(--th-shadow-sm)] transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {status === "submitting" ? "Enviando…" : "Publicar comentario"}
        </button>
      </div>
      {message && status === "error" ? (
        <p className="mt-3 text-xs text-destructive">{message}</p>
      ) : null}
    </form>
  );
}
