"use client";

import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setWorkspaceCookie } from "./_actions";

export type WorkspaceOption = {
  id: string;
  slug: string;
  name: string;
  role: string;
};

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function pick(slug: string) {
    setOpen(false);
    if (slug === current.slug) return;
    startTransition(async () => {
      await setWorkspaceCookie(slug);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-2.5 py-1.5 text-sm font-medium backdrop-blur transition-colors hover:bg-muted/50"
        disabled={pending}
      >
        <span className="grid size-6 place-items-center rounded-md bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-[11px] font-bold text-white">
          {current.name.charAt(0)}
        </span>
        <span className="max-w-[140px] truncate">{current.name}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur">
            <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Workspaces
            </p>
            <ul className="space-y-0.5">
              {workspaces.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => pick(w.slug)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <span className="grid size-6 place-items-center rounded-md bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-[11px] font-bold text-white">
                      {w.name.charAt(0)}
                    </span>
                    <span className="flex-1 truncate text-left">{w.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {w.role}
                    </span>
                    {w.slug === current.slug ? <Check className="size-3.5 text-primary" /> : null}
                  </button>
                </li>
              ))}
            </ul>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/admin/sitios"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <LayoutGrid className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-left">Ver todos mis sitios</span>
            </Link>
            <Link
              href="/admin/sitios/nuevo"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <Plus className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-left">Crear nuevo sitio</span>
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
