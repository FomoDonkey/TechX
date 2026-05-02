"use client";

import { PasteUrlDialog } from "@/components/admin/uploader/paste-url-dialog";
import { useUploader } from "@/components/admin/uploader/upload-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isEditableTarget } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { Grid3x3, LayoutList, Link2, Search, Upload, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const TYPES = [
  { value: "all", label: "Todo" },
  { value: "image", label: "Imágenes" },
  { value: "video", label: "Vídeo" },
  { value: "audio", label: "Audio" },
  { value: "doc", label: "Docs" },
] as const;

export function FilterBar({
  view,
  type,
  q,
  altMissing,
  folderId,
}: {
  view: "grid" | "list";
  type: string;
  q: string;
  altMissing: boolean;
  folderId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { open: openPicker, setActiveFolder } = useUploader();
  const [search, setSearch] = useState(q);

  useEffect(() => {
    setActiveFolder(folderId);
  }, [folderId, setActiveFolder]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: solo `search` debe disparar el debounce; el resto se lee fresco dentro del setTimeout
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  function setParam(key: string, val: string | null) {
    const next = new URLSearchParams(params.toString());
    if (val === null || val === "") next.delete(key);
    else next.set(key, val);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  // Keyboard: 'u' opens uploader.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (e.key === "u" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openPicker();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPicker]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-3">
      <div className="flex flex-1 items-center gap-2">
        <div className="flex flex-1 items-center rounded-lg border bg-card px-2 focus-within:ring-2 focus-within:ring-primary/40 sm:max-w-sm">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nombre, alt o caption…"
            className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Limpiar"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5 text-xs">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setParam("type", t.value === "all" ? null : t.value)}
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors",
                (type === t.value || (t.value === "all" && !type)) &&
                  "bg-primary/15 text-foreground",
                !(type === t.value || (t.value === "all" && !type)) &&
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setParam("alt", altMissing ? null : "missing")}
          className={cn(
            "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
            altMissing
              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          Sin alt
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
        <button
          type="button"
          onClick={() => setParam("view", "grid")}
          className={cn(
            "rounded-md p-1.5",
            view === "grid"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          aria-label="Vista cuadrícula"
        >
          <Grid3x3 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setParam("view", "list")}
          className={cn(
            "rounded-md p-1.5",
            view === "list"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          aria-label="Vista lista"
        >
          <LayoutList className="size-4" />
        </button>
      </div>

      <PasteUrlDialog
        folderId={folderId}
        trigger={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Link2 className="size-3.5" />
            URL
          </Button>
        }
      />

      <Button onClick={openPicker} size="sm" className="gap-1.5">
        <Upload className="size-3.5" />
        Subir
        <kbd className="ml-1 hidden rounded bg-primary-foreground/15 px-1 text-[10px] sm:inline">
          U
        </kbd>
      </Button>
    </div>
  );
}
