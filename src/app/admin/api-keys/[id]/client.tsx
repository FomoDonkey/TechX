"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { rotateKeyAction } from "../_actions";

export type AuditRow = {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  denyReason: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAtIso: string;
  tone: "ok" | "warn" | "err";
};

const STATUS_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "2xx", label: "2xx" },
  { id: "4xx", label: "4xx" },
  { id: "5xx", label: "5xx" },
] as const;

const METHOD_FILTERS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function AuditTimeline({ rows }: { rows: AuditRow[] }) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "2xx" && (r.statusCode < 200 || r.statusCode >= 300)) return false;
      if (statusFilter === "4xx" && (r.statusCode < 400 || r.statusCode >= 500)) return false;
      if (statusFilter === "5xx" && r.statusCode < 500) return false;
      if (methodFilter && r.method !== methodFilter) return false;
      return true;
    });
  }, [rows, statusFilter, methodFilter]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Sin requests aún. Esta key todavía no ha sido usada.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-md border px-2 py-1 ${
                statusFilter === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMethodFilter(null)}
            className={`rounded-md border px-2 py-1 ${
              methodFilter === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Todos
          </button>
          {METHOD_FILTERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethodFilter(m)}
              className={`rounded-md border px-2 py-1 font-mono ${
                methodFilter === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Cuándo</th>
              <th className="px-3 py-2 font-medium">Método</th>
              <th className="px-3 py-2 font-medium">Path</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Duración</th>
              <th className="px-3 py-2 font-medium">Razón</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  {new Date(r.createdAtIso).toLocaleString("es-ES", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.method}</td>
                <td className="max-w-md truncate px-3 py-1.5 font-mono text-xs">{r.path}</td>
                <td className="px-3 py-1.5">
                  <Badge
                    variant={
                      r.tone === "ok" ? "outline" : r.tone === "warn" ? "secondary" : "destructive"
                    }
                    className="font-mono text-[10px]"
                  >
                    {r.statusCode}
                  </Badge>
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                  {r.durationMs}ms
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.denyReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} de {rows.length} entradas. Sólo se muestran las últimas 100.
      </p>
    </>
  );
}

export function RotateKeyButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function rotate() {
    if (!confirm("Rotar genera una nueva key. La actual sigue válida 24h como grace. ¿Continuar?"))
      return;
    setError(null);
    start(async () => {
      const r = await rotateKeyAction(id);
      if (!r.ok) setError(r.error);
      else if ("fullKey" in r && typeof r.fullKey === "string") setSecret(r.fullKey);
    });
  }

  if (secret) {
    return (
      <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="text-xs font-medium">Nueva key (cópiala — no se mostrará otra vez)</p>
        <code className="block break-all rounded bg-background p-2 text-xs">{secret}</code>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-right">
      <Button onClick={rotate} disabled={disabled || pending} variant="outline" size="sm">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        <span>Rotar key</span>
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
