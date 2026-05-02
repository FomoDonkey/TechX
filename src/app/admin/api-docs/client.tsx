"use client";

import type { RegisteredRoute } from "@/api/openapi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  routes: RegisteredRoute[];
  serverUrl: string;
};

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
  POST: "text-blue-700 dark:text-blue-400 bg-blue-500/10",
  PATCH: "text-amber-700 dark:text-amber-400 bg-amber-500/10",
  PUT: "text-violet-700 dark:text-violet-400 bg-violet-500/10",
  DELETE: "text-rose-700 dark:text-rose-400 bg-rose-500/10",
};

export function ApiDocsClient({ routes, serverUrl }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, RegisteredRoute[]>();
    for (const r of routes) {
      const list = map.get(r.tag) ?? [];
      list.push(r);
      map.set(r.tag, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [routes]);

  const [selected, setSelected] = useState<RegisteredRoute>(routes[0]!);
  const [search, setSearch] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Persistir la API key en localStorage para no tener que pegarla en cada navegación
  useEffect(() => {
    const stored = localStorage.getItem("csm:api-docs:key") ?? "";
    setApiKey(stored);
  }, []);
  useEffect(() => {
    if (apiKey) localStorage.setItem("csm:api-docs:key", apiKey);
  }, [apiKey]);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped
      .map(
        ([tag, list]) =>
          [
            tag,
            list.filter(
              (r) =>
                r.path.toLowerCase().includes(q) ||
                r.summary.toLowerCase().includes(q) ||
                r.method.toLowerCase().includes(q),
            ),
          ] as const,
      )
      .filter(([, list]) => list.length > 0);
  }, [grouped, search]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 overflow-y-auto border-r bg-card/30 lg:block">
        <div className="sticky top-0 z-10 space-y-2 border-b bg-card/80 p-4 backdrop-blur">
          <h1 className="font-semibold">API Reference</h1>
          <Input
            placeholder="Buscar endpoint…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Download className="size-3" /> openapi.json
          </a>
        </div>
        <nav className="p-2 text-sm">
          {filteredGrouped.map(([tag, list]) => (
            <div key={tag} className="mb-2">
              <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {tag}
              </p>
              <ul className="space-y-0.5">
                {list.map((r) => {
                  const active = selected.method === r.method && selected.path === r.path;
                  return (
                    <li key={`${r.method}-${r.path}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs",
                          active ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold",
                            METHOD_COLORS[r.method] ?? "bg-muted",
                          )}
                        >
                          {r.method}
                        </span>
                        <span className="truncate font-mono">{r.path}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Detail */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
          <EndpointDetail
            route={selected}
            apiKey={apiKey}
            setApiKey={setApiKey}
            serverUrl={serverUrl}
          />
          <SignatureGuide />
        </div>
      </main>
    </div>
  );
}

function EndpointDetail({
  route,
  apiKey,
  setApiKey,
  serverUrl,
}: {
  route: RegisteredRoute;
  apiKey: string;
  setApiKey: (s: string) => void;
  serverUrl: string;
}) {
  const fullUrl = `${serverUrl}${route.path}`;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded px-2 py-1 font-mono text-xs font-bold",
              METHOD_COLORS[route.method] ?? "bg-muted",
            )}
          >
            {route.method}
          </span>
          <code className="font-mono text-base">{route.path}</code>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{route.summary}</h2>
        {route.description ? (
          <p className="text-sm text-muted-foreground">{route.description}</p>
        ) : null}
        {route.scopes && route.scopes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Requiere scope:</span>
            {route.scopes.map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        ) : null}
      </header>

      <ParamsSection title="Path params" schema={route.params} kind="path" />
      <ParamsSection title="Query params" schema={route.query} kind="query" />
      {route.body ? <BodySchema schema={route.body} /> : null}
      {route.response ? <ResponseSchema schema={route.response} /> : null}

      <CodeSamples url={fullUrl} method={route.method} body={route.body} />

      <TryItPanel
        method={route.method}
        path={route.path}
        serverUrl={serverUrl}
        apiKey={apiKey}
        setApiKey={setApiKey}
        body={route.body}
      />
    </div>
  );
}

function ParamsSection({
  title,
  schema,
  kind,
}: {
  title: string;
  schema?: unknown;
  kind: "path" | "query";
}) {
  if (!schema) return null;
  const fields = describeZodObject(schema);
  if (fields.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-xl border bg-card/30">
        <table className="w-full text-sm">
          <tbody>
            {fields.map((f) => (
              <tr key={f.name} className="border-b last:border-b-0">
                <td className="w-1/4 px-3 py-2 font-mono text-xs">
                  {f.name}
                  {f.optional ? <span className="text-muted-foreground"> ?</span> : ""}
                </td>
                <td className="w-1/4 px-3 py-2 text-xs text-muted-foreground">{f.type}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {kind === "query"
          ? "Tip: usa ?where[field][op]=value para filtros y ?sort=-field para orden descendente."
          : null}
      </p>
    </section>
  );
}

function BodySchema({ schema }: { schema: unknown }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Body (application/json)
      </h3>
      <div className="rounded-xl border bg-card/30 p-3">
        <pre className="overflow-x-auto text-xs">
          {JSON.stringify(zodToExample(schema), null, 2)}
        </pre>
      </div>
    </section>
  );
}

function ResponseSchema({ schema }: { schema: unknown }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Respuesta 200
      </h3>
      <div className="rounded-xl border bg-card/30 p-3">
        <pre className="overflow-x-auto text-xs">
          {JSON.stringify(zodToExample(schema), null, 2)}
        </pre>
      </div>
    </section>
  );
}

function CodeSamples({
  url,
  method,
  body,
}: {
  url: string;
  method: string;
  body?: unknown;
}) {
  const [tab, setTab] = useState<"curl" | "fetch" | "node">("curl");
  const [copied, setCopied] = useState(false);
  const bodyExample = body ? JSON.stringify(zodToExample(body), null, 2) : null;

  const samples = {
    curl: `curl -X ${method} '${url}' \\
  -H 'Authorization: Bearer csm_live_...' \\
  -H 'Content-Type: application/json'${bodyExample ? ` \\\n  -d '${bodyExample.replace(/\n/g, "")}'` : ""}`,
    fetch: `await fetch('${url}', {
  method: '${method}',
  headers: {
    'Authorization': 'Bearer ' + process.env.CSM_API_KEY,
    'Content-Type': 'application/json',
  },${bodyExample ? `\n  body: JSON.stringify(${bodyExample}),` : ""}
}).then(r => r.json())`,
    node: `// Con el SDK \`@csm/sdk\` (en F7c)
import { createClient } from '@csm/sdk';
const csm = createClient({ apiKey: process.env.CSM_API_KEY! });
// Hipotético — la forma final dependerá del recurso`,
  };

  const current = samples[tab];

  function copy() {
    navigator.clipboard.writeText(current);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Código
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-card/30 text-xs">
            {(["curl", "fetch", "node"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "px-2.5 py-1",
                  tab === t ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={copy} className="h-7 gap-1.5 text-xs">
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-xl border bg-foreground/5 p-3 text-xs">{current}</pre>
    </section>
  );
}

function TryItPanel({
  method,
  path,
  serverUrl,
  apiKey,
  setApiKey,
  body,
}: {
  method: string;
  path: string;
  serverUrl: string;
  apiKey: string;
  setApiKey: (s: string) => void;
  body?: unknown;
}) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState(body ? JSON.stringify(zodToExample(body), null, 2) : "");
  const [response, setResponse] = useState<{
    status: number;
    body: string;
    headers: Record<string, string>;
    durationMs: number;
  } | null>(null);
  const [pending, setPending] = useState(false);

  const pathParams = path.match(/\{[^}]+\}/g)?.map((s) => s.slice(1, -1)) ?? [];

  async function send() {
    setPending(true);
    setResponse(null);
    let urlPath = path;
    for (const p of pathParams) {
      const v = params[p];
      if (!v) {
        alert(`Falta el path param: ${p}`);
        setPending(false);
        return;
      }
      urlPath = urlPath.replace(`{${p}}`, encodeURIComponent(v));
    }
    const url = `${serverUrl}${urlPath}`;
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...(method !== "GET" && bodyText.trim() ? { body: bodyText } : {}),
      });
      const text = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });
      setResponse({ status: res.status, body: text, headers, durationMs: Date.now() - startedAt });
    } catch (err) {
      setResponse({
        status: 0,
        body: err instanceof Error ? err.message : "Error de red",
        headers: {},
        durationMs: Date.now() - startedAt,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card/30 p-5">
      <div>
        <h3 className="text-sm font-semibold">Probar endpoint</h3>
        <p className="text-xs text-muted-foreground">
          Crea una API key en{" "}
          <a href="/admin/api-keys" className="text-primary hover:underline">
            /admin/api-keys
          </a>{" "}
          y pégala aquí. Se guarda solo en este navegador (localStorage).
        </p>
      </div>
      <Input
        placeholder="csm_live_..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        type="password"
        className="font-mono text-xs"
      />
      {pathParams.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Path params
          </p>
          <div className="grid grid-cols-2 gap-2">
            {pathParams.map((p) => (
              <Input
                key={p}
                placeholder={p}
                value={params[p] ?? ""}
                onChange={(e) => setParams((prev) => ({ ...prev, [p]: e.target.value }))}
                className="text-xs"
              />
            ))}
          </div>
        </div>
      ) : null}
      {body ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Body JSON
          </p>
          <Textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
        </div>
      ) : null}
      <Button onClick={send} disabled={pending || !apiKey} className="gap-2">
        <Send className="size-4" />
        {pending ? "Enviando…" : `Enviar ${method}`}
      </Button>
      {response ? (
        <div className="space-y-2 rounded-xl border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-xs">
            <Badge
              className={cn(
                response.status >= 200 && response.status < 300
                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                  : response.status >= 400
                    ? "bg-destructive/15 text-destructive"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              )}
            >
              HTTP {response.status || "ERR"}
            </Badge>
            <span className="text-muted-foreground">{response.durationMs}ms</span>
          </div>
          <pre className="max-h-96 overflow-auto rounded bg-foreground/5 p-2 font-mono text-[11px]">
            {tryFormatJson(response.body)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function SignatureGuide() {
  return (
    <section id="webhooks" className="rounded-2xl border bg-card/30 p-5 text-sm">
      <h3 className="font-semibold">Verificar firmas de webhooks</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada delivery incluye los headers <code className="font-mono">X-CSM-Signature</code>,{" "}
        <code className="font-mono">X-CSM-Timestamp</code> y{" "}
        <code className="font-mono">X-CSM-Event</code>. Verifica con HMAC SHA-256:
      </p>
      <pre className="mt-3 overflow-x-auto rounded bg-foreground/5 p-3 text-[11px]">{`import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(secret, body, timestamp, signature) {
  const expected = createHmac('sha256', secret)
    .update(\`\${timestamp}.\${body}\`)
    .digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}`}</pre>
    </section>
  );
}

// ============================================================
// Helpers locales (evitan importar Zod en el cliente)
// ============================================================

function describeZodObject(schema: unknown): Array<{
  name: string;
  type: string;
  optional: boolean;
  description: string;
}> {
  // Cast lo necesario a la API privada de Zod
  const def = (schema as { _def?: { typeName?: string; shape?: unknown } } | undefined)?._def;
  if (!def) return [];
  let shape: Record<string, unknown> | undefined;
  if (def.typeName === "ZodObject") {
    shape =
      typeof def.shape === "function"
        ? (def.shape as () => Record<string, unknown>)()
        : (def.shape as Record<string, unknown>);
  } else if (def.typeName === "ZodEffects") {
    return describeZodObject((def as unknown as { schema: unknown }).schema);
  }
  if (!shape) return [];
  return Object.entries(shape).map(([name, raw]) => {
    const inner = raw as { _def?: { typeName?: string; innerType?: unknown } };
    const tn = inner._def?.typeName ?? "";
    const optional = tn === "ZodOptional" || tn === "ZodDefault";
    return {
      name,
      type: prettyType(raw),
      optional,
      description: "",
    };
  });
}

function prettyType(raw: unknown): string {
  const def = (
    raw as
      | { _def?: { typeName?: string; innerType?: unknown; values?: unknown[]; type?: unknown } }
      | undefined
  )?._def;
  if (!def) return "any";
  switch (def.typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return `${prettyType(def.type)}[]`;
    case "ZodEnum":
      return Array.isArray(def.values) ? def.values.map((v) => `"${v}"`).join(" | ") : "enum";
    case "ZodOptional":
    case "ZodDefault":
    case "ZodNullable":
      return prettyType(def.innerType);
    case "ZodRecord":
      return "Record<string, any>";
    case "ZodObject":
      return "object";
    case "ZodEffects":
      return prettyType((def as unknown as { schema: unknown }).schema);
    default:
      return def.typeName?.replace(/^Zod/, "").toLowerCase() ?? "any";
  }
}

function zodToExample(raw: unknown): unknown {
  const def = (
    raw as
      | {
          _def?: {
            typeName?: string;
            innerType?: unknown;
            type?: unknown;
            defaultValue?: () => unknown;
            values?: unknown[];
            shape?: unknown;
          };
        }
      | undefined
  )?._def;
  if (!def) return null;
  switch (def.typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return 0;
    case "ZodBoolean":
      return false;
    case "ZodArray":
      return [zodToExample(def.type)];
    case "ZodEnum":
      return Array.isArray(def.values) ? def.values[0] : "value";
    case "ZodOptional":
    case "ZodNullable":
      return zodToExample(def.innerType);
    case "ZodDefault":
      return def.defaultValue?.() ?? zodToExample(def.innerType);
    case "ZodRecord":
      return {};
    case "ZodEffects":
      return zodToExample((def as unknown as { schema: unknown }).schema);
    case "ZodObject": {
      const shape =
        typeof def.shape === "function"
          ? (def.shape as () => Record<string, unknown>)()
          : (def.shape as Record<string, unknown>);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(shape ?? {})) out[k] = zodToExample(v);
      return out;
    }
    default:
      return null;
  }
}

function tryFormatJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
