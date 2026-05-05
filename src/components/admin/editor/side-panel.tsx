"use client";

import {
  type LinkSuggestion,
  generateExcerptAction,
  suggestInternalLinksAction,
  suggestSeoTitleAction,
} from "@/ai/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";
import { CalendarClock, Globe, Link2, Loader2, Search, Sparkles, Tag, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export type SeoState = {
  title: string;
  description: string;
  ogImage: string;
};

export type SidePanelState = {
  slug: string;
  excerpt: string;
  scheduledAt: string | null;
  seo: SeoState;
};

type Props = {
  status: "draft" | "review" | "approved" | "scheduled" | "published" | "archived";
  state: SidePanelState;
  onChange: (next: Partial<SidePanelState>) => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onSchedule: () => void;
  onArchive: () => void;
  publishPath: string;
  pending?: boolean;
  /** Datos para acciones de IA */
  entryId: string;
  title: string;
  bodyText: string;
  editor: Editor | null;
};

export function SidePanel({
  status,
  state,
  onChange,
  onPublish,
  onUnpublish,
  onSchedule,
  onArchive,
  publishPath,
  pending,
  entryId,
  title,
  bodyText,
  editor,
}: Props) {
  const [tab, setTab] = useState<"publish" | "seo" | "ai">("publish");

  return (
    <aside className="flex w-full flex-col gap-4 border-t bg-card/30 p-4 md:max-w-[320px] md:border-l md:border-t-0">
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background p-1 text-xs">
        <Btn active={tab === "publish"} onClick={() => setTab("publish")}>
          Publicar
        </Btn>
        <Btn active={tab === "seo"} onClick={() => setTab("seo")}>
          SEO
        </Btn>
        <Btn active={tab === "ai"} onClick={() => setTab("ai")}>
          IA
        </Btn>
      </div>

      {tab === "publish" ? (
        <div className="space-y-4">
          <Section icon={<Globe className="size-3.5" />} title="Estado">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
              <StatusDot status={status} />
              <span className="text-xs text-muted-foreground">{publishPath}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {status === "published" ? (
                <Button size="sm" variant="outline" onClick={onUnpublish} disabled={pending}>
                  Pasar a borrador
                </Button>
              ) : (
                <Button size="sm" variant="gradient" onClick={onPublish} disabled={pending}>
                  Publicar ahora
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onArchive} disabled={pending}>
                Archivar
              </Button>
            </div>
          </Section>

          <Section icon={<Tag className="size-3.5" />} title="Slug">
            <Input
              value={state.slug}
              onChange={(e) => onChange({ slug: e.target.value })}
              placeholder="mi-post"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sólo letras, números y guiones. Se ajusta al guardar.
            </p>
          </Section>

          <Section icon={<Tag className="size-3.5" />} title="Resumen">
            <Textarea
              value={state.excerpt}
              onChange={(e) => onChange({ excerpt: e.target.value })}
              placeholder="Frase corta para listas y previews. Máx. 280."
              rows={3}
              maxLength={280}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{state.excerpt.length} / 280</p>
              <AIButton
                onRun={async () => {
                  const fresh = editor?.getText() ?? bodyText;
                  const r = await generateExcerptAction({ id: entryId, bodyText: fresh });
                  if (!r.ok) throw new Error(r.error);
                  onChange({ excerpt: r.text });
                }}
                label="Generar con IA"
              />
            </div>
          </Section>

          <Section icon={<CalendarClock className="size-3.5" />} title="Programar">
            <Input
              type="datetime-local"
              value={state.scheduledAt ?? ""}
              onChange={(e) => onChange({ scheduledAt: e.target.value || null })}
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={onSchedule}
              disabled={!state.scheduledAt || pending}
            >
              Programar publicación
            </Button>
          </Section>
        </div>
      ) : null}

      {tab === "seo" ? (
        <div className="space-y-4">
          <Section icon={<Search className="size-3.5" />} title="Título SEO">
            <Input
              value={state.seo.title}
              onChange={(e) => onChange({ seo: { ...state.seo, title: e.target.value } })}
              placeholder="Por defecto se usa el título del post"
              maxLength={120}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {state.seo.title.length} / 120 · ideal &lt; 60
              </p>
              <AIButton
                onRun={async () => {
                  const fresh = editor?.getText() ?? bodyText;
                  const r = await suggestSeoTitleAction({ title, bodyText: fresh });
                  if (!r.ok) throw new Error(r.error);
                  onChange({ seo: { ...state.seo, title: r.text } });
                }}
                label="Sugerir con IA"
              />
            </div>
          </Section>
          <Section icon={<Search className="size-3.5" />} title="Descripción SEO">
            <Textarea
              value={state.seo.description}
              onChange={(e) => onChange({ seo: { ...state.seo, description: e.target.value } })}
              placeholder="Frase para resultados de Google"
              rows={3}
              maxLength={280}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {state.seo.description.length} / 280 · ideal 150-160
              </p>
              <AIButton
                onRun={async () => {
                  const fresh = editor?.getText() ?? bodyText;
                  const r = await generateExcerptAction({ id: entryId, bodyText: fresh });
                  if (!r.ok) throw new Error(r.error);
                  onChange({ seo: { ...state.seo, description: r.text } });
                }}
                label="Generar con IA"
              />
            </div>
          </Section>
          <Section icon={<Search className="size-3.5" />} title="Imagen Open Graph">
            <Input
              value={state.seo.ogImage}
              onChange={(e) => onChange({ seo: { ...state.seo, ogImage: e.target.value } })}
              placeholder="https://… (1200×630)"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Si lo dejas vacío, generamos una con tu paleta.
            </p>
          </Section>
        </div>
      ) : null}

      {tab === "ai" ? <AIPanel entryId={entryId} bodyText={bodyText} editor={editor} /> : null}
    </aside>
  );
}

function AIPanel({
  entryId,
  bodyText,
  editor,
}: {
  entryId: string;
  bodyText: string;
  editor: Editor | null;
}) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[] | null>(null);
  const [pending, startTransition] = useTransition();

  function loadSuggestions() {
    startTransition(async () => {
      const fresh = editor?.getText() ?? bodyText;
      const r = await suggestInternalLinksAction({ entryId, bodyText: fresh });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSuggestions(r.suggestions);
      if (r.suggestions.length === 0) {
        toast.info(
          "Aún no hay enlaces obvios; publica más contenido para mejorar las sugerencias.",
        );
      }
    });
  }

  function applyLink(s: LinkSuggestion) {
    if (!editor) return;
    // Concatenamos solo el texto de los text nodes (sin separador) y buscamos ahí.
    // Luego mapeamos el índice → posición Tiptap recorriendo los mismos nodos en orden.
    let textAcc = "";
    type Span = { pos: number; text: string };
    const spans: Span[] = [];
    editor.state.doc.descendants((node, p) => {
      if (node.isText && typeof node.text === "string") {
        spans.push({ pos: p, text: node.text });
        textAcc += node.text;
        return false;
      }
      return true;
    });

    const idx = textAcc.toLowerCase().indexOf(s.anchor.toLowerCase());
    if (idx < 0) {
      toast.error("La frase ya no aparece en el documento");
      return;
    }
    // Encuentra el span que contiene el inicio.
    let cursor = 0;
    let target: { from: number; to: number } | null = null;
    for (const sp of spans) {
      const end = cursor + sp.text.length;
      if (idx >= cursor && idx < end) {
        const off = idx - cursor;
        target = { from: sp.pos + off, to: sp.pos + off + s.anchor.length };
        break;
      }
      cursor = end;
    }
    if (!target) {
      toast.error("No se pudo localizar la posición exacta");
      return;
    }
    const href = `/blog/${s.slug}`;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: target.from, to: target.to })
      .extendMarkRange("link")
      .setLink({ href })
      .run();
    toast.success(`Enlace aplicado a "${s.anchor.slice(0, 30)}…"`);
  }

  return (
    <div className="space-y-4">
      <Section icon={<Wand2 className="size-3.5" />} title="Atajos">
        <p className="mb-2 text-xs text-muted-foreground">
          Pulsa <kbd className="rounded bg-muted px-1">⌘J</kbd> en cualquier punto para abrir AI
          Inline (12 acciones: continuar, mejorar, traducir, excerpt, título…).
        </p>
      </Section>
      <Section icon={<Link2 className="size-3.5" />} title="Enlaces internos sugeridos">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={loadSuggestions}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}{" "}
          Buscar sugerencias
        </Button>
        {suggestions ? (
          <div className="mt-2 space-y-2">
            {suggestions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Sin sugerencias. Necesitas más contenido publicado para que la IA encuentre matches
                semánticos.
              </p>
            ) : (
              suggestions.map((s) => (
                <div
                  key={`${s.id}-${s.anchor}`}
                  className="rounded-md border border-border/60 bg-background p-2 text-xs"
                >
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-0.5 text-muted-foreground">
                    Anclar: <span className="text-foreground">"{s.anchor}"</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 italic text-muted-foreground">{s.reason}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="gradient"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => applyLink(s)}
                    >
                      Aplicar
                    </Button>
                    <a
                      href={`/blog/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Ver post
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function AIButton({ onRun, label }: { onRun: () => Promise<void>; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        try {
          await onRun();
          toast.success("Hecho");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/15 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
      {label}
    </button>
  );
}

function Btn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 transition-colors",
        active ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {icon} {title}
      </Label>
      {children}
    </section>
  );
}

function StatusDot({ status }: { status: Props["status"] }) {
  const map: Record<Props["status"], { label: string; cls: string }> = {
    draft: { label: "Borrador", cls: "bg-muted-foreground" },
    review: { label: "Revisión", cls: "bg-accent" },
    approved: { label: "Aprobado", cls: "bg-success/70" },
    scheduled: { label: "Programado", cls: "bg-primary" },
    published: { label: "Publicado", cls: "bg-success" },
    archived: { label: "Archivado", cls: "bg-muted-foreground/40" },
  };
  const it = map[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className={cn("size-2 rounded-full", it.cls)} />
      {it.label}
    </span>
  );
}
