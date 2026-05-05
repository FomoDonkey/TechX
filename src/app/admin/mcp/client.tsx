"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";

type Tab = "claude-desktop" | "cursor" | "vscode" | "http";

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "claude-desktop", label: "Claude Desktop", hint: "stdio · 1-click install" },
  { id: "cursor", label: "Cursor", hint: "stdio o HTTP" },
  { id: "vscode", label: "VS Code", hint: "stdio o HTTP" },
  { id: "http", label: "HTTP remoto", hint: "Streamable HTTP" },
];

export function McpInstallTabs({ httpUrl }: { httpUrl: string }) {
  const [tab, setTab] = useState<Tab>("claude-desktop");
  const isStdio = tab !== "http";

  const cliInstall = `npx csm mcp install --client=${tab === "http" ? "claude-desktop" : tab}`;

  const stdioConfig = {
    mcpServers: {
      csm: {
        command: "node",
        args: ["/ruta/a/csm/bin/csm-mcp.mjs"],
        env: {
          DATABASE_URL: "postgresql://...",
          CSM_API_KEY: "csm_live_...",
        },
      },
    },
  };

  const httpConfig = {
    mcpServers: {
      csm: {
        url: httpUrl,
        headers: {
          Authorization: "Bearer csm_live_...",
        },
      },
    },
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === t.id
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div>
              {t.label}
              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {t.hint}
              </span>
            </div>
          </button>
        ))}
      </div>

      {isStdio ? (
        <>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>Opción A · CLI (recomendado).</strong> El comando configura tu cliente
              automáticamente y guarda la API key en la config local.
            </p>
            <CodeBlock value={cliInstall} icon={Terminal} />
            <p className="text-xs text-muted-foreground">
              Te pedirá tu API key (créala en <strong>API keys</strong> con scope{" "}
              <code>mcp:any</code>) y tu <code>DATABASE_URL</code>.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>Opción B · Manual.</strong> Pega esto en el archivo de config del cliente:
            </p>
            <CodeBlock value={JSON.stringify(stdioConfig, null, 2)} />
            <ConfigPathHint client={tab} />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>Streamable HTTP.</strong> Conecta cualquier cliente MCP-compatible al
              endpoint:
            </p>
            <CodeBlock value={httpUrl} icon={Terminal} />
            <p className="text-sm">
              Auth: header <code>Authorization: Bearer csm_live_…</code>. Funciona con curl, Cursor
              remoto, agentes serverless y cualquier IDE que hable MCP HTTP.
            </p>
            <CodeBlock value={JSON.stringify(httpConfig, null, 2)} />
          </div>
        </>
      )}
    </div>
  );
}

function CodeBlock({
  value,
  icon: Icon,
}: {
  value: string;
  icon?: typeof Terminal;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs leading-relaxed">
        <code className="font-mono">
          {Icon ? (
            <span className="mr-2 inline-flex items-center text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
          ) : null}
          {value}
        </code>
      </pre>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

function ConfigPathHint({ client }: { client: Tab }) {
  const map: Record<Tab, string> = {
    "claude-desktop":
      "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json · Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
    cursor: "~/.cursor/mcp.json",
    vscode: "~/.vscode/mcp.json",
    http: "",
  };
  const path = map[client];
  if (!path) return null;
  return <p className="text-xs text-muted-foreground">Ruta: {path}</p>;
}
