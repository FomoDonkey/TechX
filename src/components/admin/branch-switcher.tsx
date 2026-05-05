"use client";

import { clearActiveBranchAction, switchBranchAction } from "@/app/admin/branches/_actions";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

export type BranchOption = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  color: string | null;
  status: string;
};

export function BranchSwitcher({
  active,
  options,
}: {
  active: BranchOption;
  options: BranchOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  // Atajo ⌘B
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function pick(branch: BranchOption) {
    setOpen(false);
    if (branch.id === active.id) return;
    start(async () => {
      const result = branch.isDefault
        ? await clearActiveBranchAction()
        : await switchBranchAction({ branchId: branch.id });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(branch.isDefault ? "De vuelta en main" : `Editando en ${branch.name}`);
        router.refresh();
      }
    });
  }

  const isMain = active.isDefault;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
          isMain
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
            : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
        }`}
        aria-label="Cambiar branch (⌘B)"
      >
        <span
          className="size-2 rounded-full"
          style={{ background: active.color ?? "oklch(0.55 0.22 290)" }}
          aria-hidden
        />
        <GitBranch className="size-3.5" />
        <span className="max-w-[120px] truncate">{active.name}</span>
        {!isMain ? <Sparkles className="size-3 opacity-70" /> : null}
        <kbd className="ml-1 hidden rounded border bg-background px-1 text-[9px] text-muted-foreground sm:inline">
          ⌘B
        </kbd>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 origin-top-right space-y-1 rounded-xl border bg-popover p-1.5 shadow-lg">
          <p className="px-2 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Cambiar branch
          </p>
          <ul className="max-h-72 overflow-y-auto">
            {options.map((b) => {
              const active_ = b.id === active.id;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => pick(b)}
                    disabled={pending}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      active_ ? "bg-muted/60" : "hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: b.color ?? "oklch(0.55 0.22 290)" }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate font-medium">{b.name}</span>
                    {b.isDefault ? (
                      <Badge variant="secondary" className="text-[9px]">
                        main
                      </Badge>
                    ) : null}
                    {active_ ? <span className="text-primary text-[10px]">●</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t pt-1">
            <Link
              href="/admin/branches"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/40"
            >
              <Plus className="size-3.5" />
              Crear o gestionar branches…
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
