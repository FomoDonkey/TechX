"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

export function SearchInput({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const sp = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (value === initial) return;
      const params = new URLSearchParams(sp);
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, 250);
    return () => clearTimeout(id);
  }, [value, initial, pathname, router, sp]);

  return (
    <div className="relative w-full md:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por título o contenido…"
        className="h-10 w-full rounded-lg border border-border/60 bg-card/40 pl-9 pr-9 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
          aria-label="Limpiar búsqueda"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      {pending ? (
        <span className="absolute -bottom-0.5 left-0 h-0.5 w-full animate-pulse bg-primary/60" />
      ) : null}
    </div>
  );
}
