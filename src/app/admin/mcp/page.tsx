import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { requireWorkspace } from "@/lib/workspace";
import {
  ArrowRight,
  BookOpen,
  Brain,
  GitBranch,
  Heart,
  Image as ImageIcon,
  Layers,
  ListTree,
  Mail,
  type Plug,
  Search,
  Settings2,
  Sparkles,
  Stethoscope,
  Tag,
  Wand2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { McpInstallTabs } from "./client";

export const metadata: Metadata = { title: "MCP · CSM" };
export const dynamic = "force-dynamic";

const TOOLS: Array<{
  name: string;
  desc: string;
  icon: typeof Plug;
  scope: string;
  destructive?: boolean;
}> = [
  {
    name: "workspace_info",
    desc: "Metadatos + stats del workspace",
    icon: Settings2,
    scope: "any",
  },
  {
    name: "entry_search",
    desc: "Búsqueda híbrida BM25 + vector",
    icon: Search,
    scope: "entries:read",
  },
  {
    name: "entry_list",
    desc: "Listado por colección con filtros",
    icon: ListTree,
    scope: "entries:read",
  },
  {
    name: "entry_get",
    desc: "Lee una entrada por id o slug",
    icon: BookOpen,
    scope: "entries:read",
  },
  {
    name: "entry_create",
    desc: "Crea draft",
    icon: Wand2,
    scope: "entries:write",
    destructive: true,
  },
  {
    name: "entry_update",
    desc: "Actualiza campos + bodyMarkdown",
    icon: Wand2,
    scope: "entries:write",
    destructive: true,
  },
  {
    name: "entry_publish",
    desc: "Publica (idempotente)",
    icon: Sparkles,
    scope: "entries:publish",
    destructive: true,
  },
  {
    name: "health_summary",
    desc: "Score + issues por severidad/tipo + top problemáticas",
    icon: Heart,
    scope: "entries:read",
  },
  {
    name: "entry_health_scan",
    desc: "Escanea una entry y devuelve score + issues",
    icon: Stethoscope,
    scope: "entries:read",
  },
  { name: "collection_list", desc: "Lista colecciones del workspace", icon: Layers, scope: "any" },
  { name: "taxonomy_list", desc: "Lista categorías y tags", icon: Tag, scope: "any" },
  { name: "branch_list", desc: "Branches con stats", icon: GitBranch, scope: "any" },
  {
    name: "media_search",
    desc: "Busca medios por nombre / alt / caption",
    icon: ImageIcon,
    scope: "media:read",
  },
  {
    name: "subscriber_list",
    desc: "Lista suscriptores newsletter",
    icon: Mail,
    scope: "subscribers:read",
  },
];

export default async function McpPage() {
  await requireWorkspace("admin");
  const httpUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/mcp`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-8">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge className="border-transparent bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] text-white">
              ✦ Único en CMS open-source 2026
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">MCP Server</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Conecta cualquier agente IA (Claude Desktop, Cursor, Cline, IDE plugins) a tu CSM y
              deja que gestione contenido como una herramienta más:{" "}
              <em>"Crea un draft sobre X y publícalo el martes"</em> funciona out-of-the-box.
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white shadow-lg">
              <Brain className="size-8" />
            </div>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cómo conectarlo</h2>
        <div className="rounded-xl border bg-card p-2">
          <McpInstallTabs httpUrl={httpUrl} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Tools disponibles ({TOOLS.length})</h2>
          <Link
            href="/admin/api-keys"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Crear API key con scope <code className="rounded bg-muted px-1 py-0.5">mcp:any</code>{" "}
            <ArrowRight className="inline size-3" />
          </Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <li
                key={t.name}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-card/80"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-medium">{t.name}</code>
                    {t.destructive ? (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        muta
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Scope:{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{t.scope}</code>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-6">
        <h3 className="font-semibold">¿Qué le pides al agente?</h3>
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>
            · "Busca posts sobre <em>landing</em> y resúmemelos"
          </li>
          <li>· "Crea un draft titulado X y rellénalo con esto…"</li>
          <li>· "¿Qué tengo programado para esta semana?"</li>
          <li>· "Lista mis suscriptores activos en español"</li>
          <li>· "Publica el post Y ahora mismo"</li>
          <li>· "Resúmeme los conflictos abiertos en mis branches"</li>
        </ul>
      </section>
    </div>
  );
}
