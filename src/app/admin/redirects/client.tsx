"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Redirect } from "@/db/schema";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  bulkRedirectAction,
  createRedirectAction,
  deleteRedirectAction,
  exportCsvAction,
  importCsvAction,
  previewCsvImportAction,
  testRedirectAction,
  updateRedirectAction,
} from "./actions";

interface Props {
  initialItems: Redirect[];
}

type MatchType = "exact" | "prefix" | "regex";
type StatusCode = 301 | 302 | 307 | 308;

export function RedirectsClient({ initialItems }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Redirect | null>(null);
  const [testPath, setTestPath] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return initialItems.filter((r) => {
      if (filter === "enabled" && !r.enabled) return false;
      if (filter === "disabled" && r.enabled) return false;
      if (term) {
        return r.source.toLowerCase().includes(term) || r.destination.toLowerCase().includes(term);
      }
      return true;
    });
  }, [initialItems, q, filter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const bulkAction = (action: "delete" | "enable" | "disable") => {
    if (selected.size === 0) return;
    if (action === "delete" && !confirm(`¿Eliminar ${selected.size} redirecciones?`)) return;
    start(async () => {
      try {
        const r = await bulkRedirectAction({ ids: [...selected], action });
        toast.success(`Aplicado a ${r.count}`);
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const exportCsv = () => {
    start(async () => {
      try {
        const r = await exportCsvAction();
        if (!r.csv) {
          toast.error("Sin datos");
          return;
        }
        const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `redirects-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const test = () => {
    if (!testPath.trim()) return;
    start(async () => {
      try {
        const r = await testRedirectAction({ path: testPath.trim() });
        if (r.match) {
          toast.success(`${testPath} → ${r.destination} (${r.statusCode})`, { duration: 6000 });
        } else {
          toast.info(`Sin match para ${testPath}`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/30 p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por origen o destino"
            className="pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="enabled">Activos</option>
          <option value="disabled">Pausados</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="size-3.5" /> Importar CSV
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={pending}>
            <Download className="size-3.5" /> Exportar
          </Button>
          <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> Nueva regla
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/30 p-3 text-sm">
        <span className="text-muted-foreground">Probar redirección:</span>
        <Input
          value={testPath}
          onChange={(e) => setTestPath(e.target.value)}
          placeholder="/old-path"
          className="max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && test()}
        />
        <Button variant="outline" size="sm" onClick={test} disabled={pending}>
          Probar
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-primary/5 p-3 text-sm">
          <span>{selected.size} seleccionadas</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => bulkAction("enable")}
          >
            <Power className="size-3.5" /> Activar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => bulkAction("disable")}
          >
            <PowerOff className="size-3.5" /> Pausar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive"
            onClick={() => bulkAction("delete")}
          >
            <Trash2 className="size-3.5" /> Eliminar
          </Button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {initialItems.length === 0
              ? "Sin redirecciones todavía. Crea la primera arriba o importa un CSV."
              : "Ningún resultado para este filtro."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card/30">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {
                      if (allSelected) setSelected(new Set());
                      else setSelected(new Set(filtered.map((r) => r.id)));
                    }}
                  />
                </th>
                <th className="p-3">Origen</th>
                <th className="p-3" />
                <th className="p-3">Destino</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Hits</th>
                <th className="p-3" />
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className={cn("hover:bg-muted/30", !r.enabled && "opacity-60")}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="p-3 font-mono text-xs">
                    <span className="block truncate max-w-[200px]">{r.source}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    <ArrowRight className="size-3" />
                  </td>
                  <td className="p-3 font-mono text-xs">
                    <span className="block truncate max-w-[260px]">{r.destination}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">
                      {r.matchType}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      className={cn(
                        "text-[10px]",
                        r.statusCode === 301 || r.statusCode === 308
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {r.statusCode}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="font-medium">{r.hits.toLocaleString("es")}</span>
                  </td>
                  <td className="p-3">
                    {r.enabled ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <XCircle className="size-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditOpen(r)}
                      aria-label="Editar redirección"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateOrEditDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => router.refresh()}
      />
      {editOpen ? (
        <CreateOrEditDialog
          open={true}
          onOpenChange={(b) => !b && setEditOpen(null)}
          editing={editOpen}
          onSaved={() => {
            setEditOpen(null);
            router.refresh();
          }}
        />
      ) : null}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

// ============================================================
// Create / edit dialog
// ============================================================
function CreateOrEditDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing?: Redirect;
  onSaved: () => void;
}) {
  const [source, setSource] = useState(editing?.source ?? "");
  const [destination, setDestination] = useState(editing?.destination ?? "");
  const [matchType, setMatchType] = useState<MatchType>(
    (editing?.matchType as MatchType) ?? "exact",
  );
  const [statusCode, setStatusCode] = useState<StatusCode>(
    (editing?.statusCode as StatusCode) ?? 301,
  );
  const [preserveQuery, setPreserveQuery] = useState(editing?.preserveQuery ?? true);
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [pending, start] = useTransition();

  const submit = () => {
    if (!source.trim() || !destination.trim()) {
      toast.error("Origen y destino obligatorios");
      return;
    }
    start(async () => {
      try {
        if (editing) {
          await updateRedirectAction({
            id: editing.id,
            source,
            destination,
            matchType,
            statusCode,
            preserveQuery,
            enabled,
            description,
          });
          toast.success("Redirección actualizada");
        } else {
          await createRedirectAction({
            source,
            destination,
            matchType,
            statusCode,
            preserveQuery,
            enabled,
            description,
          });
          toast.success("Redirección creada");
        }
        onOpenChange(false);
        onSaved();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const destroy = () => {
    if (!editing) return;
    if (!confirm("¿Eliminar esta redirección?")) return;
    start(async () => {
      try {
        await deleteRedirectAction(editing.id);
        toast.success("Eliminada");
        onOpenChange(false);
        onSaved();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">
            {editing ? "Editar redirección" : "Nueva redirección"}
          </Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            Origen ↦ destino. Tipo exact valida match completo. Prefix incluye sub-paths. Regex usa
            sintaxis JavaScript con capturas $1, $2…
          </Dialog.Description>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-source">Origen</Label>
                <Input
                  id="r-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder={matchType === "regex" ? "^/blog/(.*)" : "/old-path"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-dest">Destino</Label>
                <Input
                  id="r-dest"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="/new-path o https://…"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de match</Label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as MatchType)}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="exact">Exact (match completo)</option>
                  <option value="prefix">Prefix (incluye sub-paths)</option>
                  <option value="regex">Regex (avanzado)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Código de respuesta</Label>
                <select
                  value={statusCode}
                  onChange={(e) => setStatusCode(Number(e.target.value) as StatusCode)}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value={301}>301 — Permanente</option>
                  <option value={302}>302 — Temporal</option>
                  <option value={307}>307 — Temporal (preserva method)</option>
                  <option value={308}>308 — Permanente (preserva method)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-desc">Descripción (opcional)</Label>
              <Textarea
                id="r-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Por qué existe esta redirección"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Preservar query string</p>
                <p className="text-[11px] text-muted-foreground">
                  Mantiene parámetros del request en el destino.
                </p>
              </div>
              <Switch checked={preserveQuery} onCheckedChange={setPreserveQuery} />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Activa</p>
                <p className="text-[11px] text-muted-foreground">Si está pausada, no se aplica.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
          <div className="mt-6 flex justify-between gap-2">
            <div>
              {editing ? (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={destroy}
                  disabled={pending}
                >
                  <Trash2 className="size-3.5" /> Eliminar
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending ? "Guardando…" : editing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ============================================================
// CSV Import dialog
// ============================================================
interface PreviewState {
  rows: Array<{ source: string; destination: string }>;
  errors: Array<{ line: number; message: string }>;
  total: number;
  valid: number;
}

function ImportDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onSaved: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [skipExisting, setSkipExisting] = useState(true);
  const [pending, start] = useTransition();

  const doPreview = () => {
    if (!csv.trim()) return;
    start(async () => {
      try {
        const r = await previewCsvImportAction({ csv });
        setPreview(r);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const doImport = () => {
    start(async () => {
      try {
        const r = await importCsvAction({ csv, skipExisting });
        if (!r.ok) {
          toast.error("CSV no se pudo importar");
          return;
        }
        toast.success(
          `Insertadas ${r.inserted}, omitidas ${r.skipped}, errores ${r.errors.length}`,
        );
        setCsv("");
        setPreview(null);
        onOpenChange(false);
        onSaved();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">
            Importar redirecciones (CSV)
          </Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            Headers:{" "}
            <code>source,destination,statusCode,matchType,preserveQuery,enabled,description</code>.
            Sólo source y destination son obligatorios. Máximo 1000 filas.
          </Dialog.Description>
          <div className="space-y-3">
            <Textarea
              rows={8}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={
                "source,destination,statusCode,matchType\n/old,/new,301,exact\n/blog/(.*),/posts/$1,301,regex"
              }
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={doPreview} disabled={pending || !csv.trim()}>
                Previsualizar
              </Button>
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  id="skip-existing"
                  checked={skipExisting}
                  onCheckedChange={setSkipExisting}
                />
                <Label htmlFor="skip-existing">Omitir si origen ya existe</Label>
              </div>
            </div>
            {preview ? (
              <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
                <div className="flex flex-wrap gap-x-4 text-[11px]">
                  <span>
                    Total: <strong>{preview.total}</strong>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Válidas: <strong>{preview.valid}</strong>
                  </span>
                  <span className="text-destructive">
                    Errores: <strong>{preview.errors.length}</strong>
                  </span>
                </div>
                {preview.errors.length > 0 ? (
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto text-destructive">
                    {preview.errors.slice(0, 30).map((e) => (
                      <li key={`${e.line}-${e.message}`}>
                        <span className="font-mono">L{e.line}</span> {e.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={doImport} disabled={pending || !preview || preview.valid === 0}>
              {pending ? "Importando…" : `Importar ${preview?.valid ?? 0}`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
