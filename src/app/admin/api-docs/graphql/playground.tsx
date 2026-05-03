"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Download, History, KeyRound, Play, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STARTERS: Array<{ name: string; query: string; variables?: string }> = [
  {
    name: "Health check",
    query: "query Health { health }",
  },
  {
    name: "Lista de entries",
    query: `query Entries($limit: Int) {
  entries(limit: $limit, status: published) {
    nodes { id title slug publishedAt }
    pageInfo { hasMore nextCursor count }
  }
}`,
    variables: '{ "limit": 10 }',
  },
  {
    name: "Entry por slug",
    query: `query EntryBySlug($slug: String!) {
  entry(slug: $slug) { id title body publishedAt }
}`,
    variables: '{ "slug": "hola-mundo" }',
  },
  {
    name: "Colecciones",
    query: `query Collections {
  collections { id name slug isBuiltin }
}`,
  },
  {
    name: "Menús",
    query: `query Menus {
  menus { id name slug location version }
}`,
  },
  {
    name: "Redirecciones activas",
    query: `query Redirects {
  redirects(enabled: true) { id source destination statusCode matchType hits }
}`,
  },
];

interface Run {
  id: string;
  query: string;
  variables: string;
  response: string;
  status: number;
  durationMs: number;
  ts: number;
}

const STORAGE_KEY = "csm.graphql.playground.v1";

export function Playground() {
  const [query, setQuery] = useState(STARTERS[0]?.query ?? "");
  const [variables, setVariables] = useState("{}");
  const [apiKey, setApiKey] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<Run[]>([]);
  const [tab, setTab] = useState<"variables" | "headers" | "history">("variables");

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { apiKey?: string; history?: Run[] };
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.history) setHistory(data.history);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, history }));
    } catch {
      /* ignore */
    }
  }, [apiKey, history]);

  const run = async () => {
    setRunning(true);
    const startedAt = performance.now();
    try {
      let parsedVars: unknown = {};
      if (variables.trim()) {
        try {
          parsedVars = JSON.parse(variables);
        } catch {
          setResponse("⚠️ Variables JSON inválido");
          setStatus(0);
          setRunning(false);
          return;
        }
      }
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ query, variables: parsedVars }),
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      setResponse(pretty);
      setStatus(res.status);
      const elapsed = Math.round(performance.now() - startedAt);
      setDuration(elapsed);
      setHistory((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            query,
            variables,
            response: pretty.slice(0, 400),
            status: res.status,
            durationMs: elapsed,
            ts: Date.now(),
          },
          ...prev,
        ].slice(0, 30),
      );
    } catch (e) {
      setResponse(`Error de red: ${e instanceof Error ? e.message : String(e)}`);
      setStatus(0);
    } finally {
      setRunning(false);
    }
  };

  const downloadSchema = async () => {
    const r = await fetch("/api/graphql/schema");
    const text = await r.text();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "csm.graphql";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:h-[calc(100vh-4rem)] lg:grid-cols-[260px_1fr_1fr]">
      <aside className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">GraphQL Playground</h1>
          <p className="text-xs text-muted-foreground">
            Endpoint: <code>/api/graphql</code>
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
            <KeyRound className="size-3" /> API key
          </Label>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="csm_live_…"
            type="password"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Se guarda en localStorage de tu navegador.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
            <Sparkles className="size-3" /> Plantillas
          </Label>
          <div className="space-y-1">
            {STARTERS.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setQuery(s.query);
                  if (s.variables) setVariables(s.variables);
                }}
                className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-muted/50"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={downloadSchema}>
          <Download className="size-3.5" /> Descargar SDL
        </Button>
      </aside>

      <section className="flex flex-col gap-3 lg:overflow-hidden">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
            <Wand2 className="size-3" /> Query
          </Label>
          <Button onClick={run} disabled={running} className="gap-1.5">
            <Play className="size-3.5" />
            {running ? "Ejecutando…" : "Ejecutar"}
          </Button>
        </div>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={14}
          className="flex-1 resize-none font-mono text-xs"
        />
        <div className="flex gap-1 border-b text-xs">
          {(["variables", "headers", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 py-1.5 capitalize transition-colors",
                tab === t
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "history" ? "Historial" : t === "headers" ? "Headers" : "Variables"}
            </button>
          ))}
        </div>
        {tab === "variables" ? (
          <Textarea
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            rows={5}
            className="resize-none font-mono text-xs"
          />
        ) : null}
        {tab === "headers" ? (
          <div className="rounded-lg border bg-muted/20 p-3 font-mono text-[11px] text-muted-foreground">
            Authorization: Bearer {apiKey ? `${apiKey.slice(0, 12)}…` : "<api-key>"}
            <br />
            Content-Type: application/json
          </div>
        ) : null}
        {tab === "history" ? (
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ejecuciones recientes.</p>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setQuery(h.query);
                    setVariables(h.variables);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-2 py-1.5 text-left text-[11px] hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <History className="size-3 text-muted-foreground" />
                    <span className="font-mono">{h.query.slice(0, 60).replace(/\s+/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{h.status}</span>
                    <span>{h.durationMs}ms</span>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 lg:overflow-hidden">
        <Label className="flex items-center gap-3 text-[11px] uppercase tracking-wider">
          Respuesta
          {status !== null ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px]",
                status >= 200 && status < 300
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              {status}
            </span>
          ) : null}
          {duration !== null ? <span className="text-muted-foreground">{duration}ms</span> : null}
        </Label>
        <pre className="flex-1 overflow-auto rounded-lg border bg-muted/20 p-3 font-mono text-[11px]">
          {response || "// La respuesta aparecerá aquí cuando ejecutes una query"}
        </pre>
      </section>
    </div>
  );
}
