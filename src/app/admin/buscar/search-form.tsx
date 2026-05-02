"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchForm({
  initialQuery,
  initialScope,
}: {
  initialQuery: string;
  initialScope: "all" | "published";
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [scope, setScope] = useState(initialScope);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (scope === "published") params.set("scope", scope);
    startTransition(() => {
      router.replace(`/admin/buscar?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-64">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Busca: "contenido exacto", -palabra, palabra1 OR palabra2'
          className="pl-9"
          autoFocus
        />
      </div>
      <div className="inline-flex rounded-lg border border-border/60 bg-background p-1 text-xs">
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`rounded-md px-3 py-1.5 transition-colors ${scope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Todo
        </button>
        <button
          type="button"
          onClick={() => setScope("published")}
          className={`rounded-md px-3 py-1.5 transition-colors ${scope === "published" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Solo publicado
        </button>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        Buscar
      </button>
    </form>
  );
}
