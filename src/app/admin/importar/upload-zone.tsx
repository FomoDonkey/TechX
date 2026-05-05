"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const SOURCE_HINTS = [
  { id: "wordpress", label: "WordPress", emoji: "🟦", hint: ".xml o .wxr (Tools → Export)" },
  { id: "notion", label: "Notion", emoji: "📓", hint: ".zip (Markdown & CSV)" },
  { id: "ghost", label: "Ghost", emoji: "👻", hint: "Settings → Labs → Export → .json" },
  { id: "markdown", label: "Markdown", emoji: "📝", hint: ".md o .zip con varios .md" },
  { id: "rss", label: "RSS / Atom", emoji: "📡", hint: ".xml del feed" },
  { id: "csv", label: "CSV / TSV", emoji: "📊", hint: "Headers en primera fila" },
] as const;

export function UploadZone() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useCallback(
    async (file: File, sourceHint?: string) => {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (sourceHint) fd.append("source", sourceHint);
        const res = await fetch("/api/admin/imports", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Error al subir");
          return;
        }
        toast.success("Archivo procesado — abriendo wizard");
        router.push(`/admin/importar/${data.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setUploading(false);
      }
    },
    [router],
  );

  function handleFiles(files: FileList | null, sourceHint?: string) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    upload(file, sourceHint);
  }

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative w-full rounded-3xl border-2 border-dashed p-10 text-center transition-all",
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/60 bg-card/30 hover:border-primary/60 hover:bg-card/60",
          uploading && "opacity-60 pointer-events-none",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,.wxr,.zip,.json,.md,.markdown,.mdx,.rss,.atom,.csv,.tsv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
          {uploading ? <Loader2 className="size-7 animate-spin" /> : <Upload className="size-7" />}
        </div>
        <h2 className="mt-5 text-lg font-semibold">
          {uploading ? "Procesando archivo…" : "Arrastra tu archivo aquí"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O haz click para seleccionar — detectamos el formato automáticamente
        </p>
      </button>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {SOURCE_HINTS.map((s) => (
          <button
            type="button"
            key={s.id}
            onClick={() => {
              const i = inputRef.current;
              if (!i) return;
              i.dataset.sourceHint = s.id;
              i.click();
            }}
            className="rounded-xl border border-border/60 bg-card/30 p-3 text-left transition-colors hover:border-primary/60 hover:bg-card/60"
          >
            <div className="text-lg">{s.emoji}</div>
            <div className="mt-1 text-xs font-medium">{s.label}</div>
            <div className="text-[10px] text-muted-foreground line-clamp-2">{s.hint}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
