"use client";

import {
  archiveEntriesAction,
  deleteEntriesAction,
  publishEntriesAction,
  unpublishEntriesAction,
} from "@/app/admin/contenido/_actions";
import { RelativeTime } from "@/components/admin/dashboard/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import type { EntryListItem } from "@/lib/entries";
import { cn } from "@/lib/utils";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  CircleDashed,
  Pencil,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

type Status = EntryListItem["status"];

function statusBadge(status: Status) {
  switch (status) {
    case "published":
      return <Badge className="bg-success/15 text-success">Publicado</Badge>;
    case "draft":
      return <Badge variant="secondary">Borrador</Badge>;
    case "scheduled":
      return <Badge className="bg-primary/15 text-primary">Programado</Badge>;
    case "review":
      return <Badge className="bg-accent/15 text-accent">Revisión</Badge>;
    case "archived":
      return <Badge variant="outline">Archivado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function PostsTable({
  rows,
  workspaceSlug,
}: { rows: EntryListItem[]; workspaceSlug: string }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedIds = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [selection],
  );

  const columns = useMemo<ColumnDef<EntryListItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getRowModel().rows.length > 0 &&
              table.getRowModel().rows.every((r) => selection[r.original.id])
            }
            onChange={(checked) => {
              const next: Record<string, boolean> = { ...selection };
              for (const r of table.getRowModel().rows) next[r.original.id] = checked;
              setSelection(next);
            }}
            label="Seleccionar todo"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={!!selection[row.original.id]}
            onChange={(checked) => {
              setSelection((s) => ({ ...s, [row.original.id]: checked }));
            }}
            label={`Seleccionar ${row.original.title}`}
          />
        ),
        size: 36,
        enableSorting: false,
      },
      {
        accessorKey: "title",
        header: ({ column }) => <SortableHeader column={column} label="Título" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/admin/contenido/${row.original.id}`}
              className="block truncate font-medium hover:text-primary"
            >
              {row.original.title || "Sin título"}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              /{workspaceSlug}/blog/{row.original.slug}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        accessorKey: "publishedAt",
        header: ({ column }) => <SortableHeader column={column} label="Publicado" />,
        cell: ({ row }) =>
          row.original.publishedAt ? (
            <RelativeTime
              date={row.original.publishedAt}
              className="text-sm text-muted-foreground"
            />
          ) : row.original.scheduledAt ? (
            <RelativeTime
              prefix="programado"
              date={row.original.scheduledAt}
              className="text-sm text-primary"
            />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => <SortableHeader column={column} label="Actualizado" />,
        cell: ({ row }) => (
          <RelativeTime date={row.original.updatedAt} className="text-sm text-muted-foreground" />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/admin/contenido/${row.original.id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Editar"
          >
            <Pencil className="size-3" /> Editar
          </Link>
        ),
        size: 80,
        enableSorting: false,
      },
    ],
    [selection, workspaceSlug],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function clearSelection() {
    setSelection({});
  }

  function bulk(action: "publish" | "unpublish" | "archive" | "delete") {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    startTransition(async () => {
      try {
        const result =
          action === "publish"
            ? await publishEntriesAction({ ids })
            : action === "unpublish"
              ? await unpublishEntriesAction({ ids })
              : action === "archive"
                ? await archiveEntriesAction({ ids })
                : await deleteEntriesAction({ ids });
        if (result.ok) {
          const verb =
            action === "publish"
              ? "publicadas"
              : action === "unpublish"
                ? "despublicadas"
                : action === "archive"
                  ? "archivadas"
                  : "eliminadas";
          toast.success(`${ids.length} ${ids.length === 1 ? "entrada" : "entradas"} ${verb}`);
          clearSelection();
          router.refresh();
        } else {
          toast.error(result.error ?? "No se pudo completar la acción");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error inesperado");
      } finally {
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">
            {selectedIds.length} {selectedIds.length === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <span className="text-muted-foreground">·</span>
          <Button size="sm" variant="ghost" onClick={() => bulk("publish")} disabled={pending}>
            <Send className="size-3.5" /> Publicar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => bulk("unpublish")} disabled={pending}>
            <Undo2 className="size-3.5" /> A borrador
          </Button>
          <Button size="sm" variant="ghost" onClick={() => bulk("archive")} disabled={pending}>
            <Archive className="size-3.5" /> Archivar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={pending}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" /> Eliminar
          </Button>
          <span className="ml-auto" />
          <Button size="sm" variant="ghost" onClick={clearSelection} disabled={pending}>
            Cancelar
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/30">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground"
              >
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2.5 text-left font-medium"
                    style={{ width: h.getSize() === 0 ? undefined : h.column.columnDef.size }}
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12">
                  <EmptyTable />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-border/40 transition-colors hover:bg-muted/20",
                    selection[row.original.id] && "bg-primary/[0.04]",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Eliminar ${selectedIds.length} ${selectedIds.length === 1 ? "entrada" : "entradas"}`}
        description="Esta acción es permanente y elimina también las revisiones, comentarios y embeddings asociados."
        confirmLabel="Eliminar definitivamente"
        variant="destructive"
        onConfirm={() => bulk("delete")}
        pending={pending}
      />
    </div>
  );
}

function EmptyTable() {
  return (
    <div className="text-center text-sm text-muted-foreground">
      <CircleDashed className="mx-auto mb-2 size-5 opacity-60" />
      Sin resultados con estos filtros.
      <p className="mt-1 text-xs">Ajusta la búsqueda o crea una entrada con ⌘K.</p>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex size-4 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer absolute size-full cursor-pointer opacity-0"
      />
      <span
        className={cn(
          "grid size-4 place-items-center rounded border bg-background transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40",
          checked ? "border-primary" : "border-border",
        )}
      >
        {checked ? <CheckCircle2 className="size-3 text-primary-foreground" /> : null}
      </span>
    </label>
  );
}

function SortableHeader<T>({
  column,
  label,
}: { column: import("@tanstack/react-table").Column<T>; label: string }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="inline-flex items-center gap-1 text-left uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      {label}
      <Icon className="size-3" />
    </button>
  );
}
