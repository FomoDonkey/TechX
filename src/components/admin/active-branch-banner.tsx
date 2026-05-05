"use client";

import { clearActiveBranchAction } from "@/app/admin/branches/_actions";
import type { BranchOption } from "@/components/admin/branch-switcher";
import { GitBranch, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

export function ActiveBranchBanner({ branch }: { branch: BranchOption }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function exit() {
    start(async () => {
      const result = await clearActiveBranchAction();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("De vuelta en main");
        router.refresh();
      }
    });
  }

  return (
    <div
      className="flex items-center gap-3 border-b border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2 text-xs"
      style={{
        borderImage: `linear-gradient(90deg, ${branch.color ?? "oklch(0.55 0.22 290)"}, transparent) 1`,
      }}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: branch.color ?? "oklch(0.55 0.22 290)" }}
        aria-hidden
      />
      <GitBranch className="size-3.5 text-primary" />
      <span>
        Editando en <strong>{branch.name}</strong> · los cambios se forkean automáticamente y no
        afectan a producción hasta que mergees.
      </span>
      <Link
        href={`/admin/branches/${branch.id}`}
        className="ml-auto rounded-full border bg-background px-2 py-0.5 hover:bg-muted"
      >
        Ver branch
      </Link>
      <button
        type="button"
        onClick={exit}
        disabled={pending}
        className="rounded-full p-1 hover:bg-muted/50"
        title="Volver a main"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
