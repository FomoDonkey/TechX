"use client";

import { createFolderAction, deleteFolderAction } from "@/app/admin/medios/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronRight, FolderClosed, FolderPlus, Inbox, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  count: number;
};

function buildTree(nodes: FolderNode[]) {
  const byParent = new Map<string | null, FolderNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  return byParent;
}

export function FolderTree({
  folders,
  rootCount,
  current,
}: {
  folders: FolderNode[];
  rootCount: number;
  current: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const tree = buildTree(folders);

  function pushFolder(folderId: string | null) {
    const next = new URLSearchParams(params.toString());
    if (folderId) next.set("folder", folderId);
    else next.delete("folder");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function submitCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    start(async () => {
      const res = await createFolderAction({ name: trimmed, parentId: null });
      if (res.ok) {
        toast.success("Carpeta creada");
        setName("");
        setCreating(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo crear");
      }
    });
  }

  function removeFolder(id: string) {
    if (!confirm("¿Eliminar carpeta? Los archivos se moverán a la raíz.")) return;
    start(async () => {
      await deleteFolderAction(id);
      toast.success("Carpeta eliminada");
      router.refresh();
    });
  }

  function renderNode(node: FolderNode, depth = 0): React.ReactNode {
    const children = tree.get(node.id) ?? [];
    const active = current === node.id;
    return (
      <div key={node.id}>
        <div className="group flex items-center gap-1">
          <button
            type="button"
            onClick={() => pushFolder(node.id)}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
              active ? "bg-primary/12 text-foreground" : "text-foreground/80 hover:bg-muted/50",
            )}
            style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
          >
            {children.length > 0 ? (
              <ChevronRight className="size-3 text-muted-foreground" />
            ) : (
              <span className="size-3" />
            )}
            <FolderClosed className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate">{node.name}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{node.count}</span>
          </button>
          <button
            type="button"
            onClick={() => removeFolder(node.id)}
            className="invisible rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive group-hover:visible"
            aria-label="Eliminar"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const roots = tree.get(null) ?? [];

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card/30 p-3 md:block">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Carpetas
        </h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Nueva carpeta"
          title="Nueva carpeta"
        >
          <FolderPlus className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => pushFolder(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          current === null
            ? "bg-primary/12 text-foreground"
            : "text-foreground/80 hover:bg-muted/50",
        )}
      >
        <Inbox className="size-4 text-muted-foreground" />
        <span className="flex-1">Todos</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{rootCount}</span>
      </button>

      {creating ? (
        <form
          className="mt-2 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            autoFocus
            className="h-8 text-sm"
            onBlur={() => {
              if (!name.trim()) setCreating(false);
            }}
          />
          <Button type="submit" size="sm" className="h-8" disabled={pending}>
            OK
          </Button>
        </form>
      ) : null}

      <div className="mt-2 space-y-0.5">{roots.map((n) => renderNode(n, 0))}</div>
    </aside>
  );
}
