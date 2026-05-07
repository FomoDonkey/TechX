"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CheckStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function NewSiteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<CheckStatus>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-derive slug from name si el user no lo tocó.
  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugifyClient(name));
  }, [name, slugTouched]);

  // Live availability check
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "checking" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/domain/slug-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const data = (await res.json()) as
          | { ok: true; available: boolean; selfMatch: boolean }
          | { ok: false; reason: string; message: string };
        if (!data.ok) {
          setStatus({ kind: "error", message: data.message ?? "No disponible" });
        } else {
          setStatus({ kind: "ok" });
        }
      } catch {
        setStatus({ kind: "error", message: "Error de conexión" });
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    if (!name.trim() || name.trim().length < 2) {
      setSubmitError("Escribe un nombre de al menos 2 caracteres.");
      return;
    }
    if (status.kind !== "ok") {
      setSubmitError("Elige un identificador válido y disponible.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug }),
      });
      const data = (await res.json()) as
        | { ok: true; workspace: { id: string; slug: string; name: string } }
        | { ok: false; reason: string; message: string };
      if (!data.ok) {
        setSubmitError(data.message ?? "No se pudo crear el sitio.");
        return;
      }
      // Switch ya hecho server-side. Ir al dashboard del nuevo sitio.
      router.push("/admin");
      router.refresh();
    } catch {
      setSubmitError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting && name.trim().length >= 2 && slug.length >= 3 && status.kind === "ok";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border bg-card p-6">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre del sitio</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mi blog vegano"
          autoFocus
          maxLength={60}
        />
        <p className="text-[11px] text-muted-foreground">
          Lo verán los visitantes en la cabecera. Puedes cambiarlo luego.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">Identificador</Label>
        <div className="overflow-hidden rounded-md border bg-background font-mono text-sm">
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugifyClient(e.target.value));
            }}
            placeholder="mi-blog-vegano"
            maxLength={30}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
        <SlugStatus status={status} slug={slug} />
        <p className="text-[11px] text-muted-foreground">
          Aparece en la URL pública si tienes varios sitios. Solo letras minúsculas, números y
          guiones.
        </p>
      </div>

      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/sitios")}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit} className="gap-1.5">
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowRight className="size-3.5" />
          )}
          Crear sitio
        </Button>
      </div>
    </form>
  );
}

function SlugStatus({ status, slug }: { status: CheckStatus; slug: string }) {
  if (!slug || slug.length < 3) return null;
  if (status.kind === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Comprobando disponibilidad…
      </p>
    );
  }
  if (status.kind === "ok") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" />
        Disponible
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-destructive">
        <AlertCircle className="size-3" />
        {status.message}
      </p>
    );
  }
  return null;
}

// Strip diacritical combining marks. `\p{Mn}` = Mark, Nonspacing — cubre
// los combiners U+0300..U+036F (y otros bloques) sin escribir un range
// en el char class (que biome flag como `noMisleadingCharacterClass`).
const COMBINING_MARKS = /\p{Mn}/gu;

function slugifyClient(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9-\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}
