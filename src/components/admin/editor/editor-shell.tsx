"use client";

import {
  archiveEntriesAction,
  publishEntriesAction,
  saveEntryAction,
  scheduleEntryAction,
  unpublishEntriesAction,
} from "@/app/admin/contenido/_actions";
import { AIInlinePopover } from "@/components/admin/editor/ai-inline";
import { BubbleToolbar } from "@/components/admin/editor/bubble-toolbar";
import { MediaPicker } from "@/components/admin/editor/media-picker";
import { PreviewPane } from "@/components/admin/editor/preview-pane";
import { type RevisionItem, RevisionsPanel } from "@/components/admin/editor/revisions-panel";
import { SidePanel, type SidePanelState } from "@/components/admin/editor/side-panel";
import {
  type SlashController,
  SlashPopup,
  createSlashExtension,
  useSlashMenuController,
} from "@/components/admin/editor/slash-menu";
import { VoiceDictation } from "@/components/admin/editor/voice-dictation";
import "@/components/admin/editor/editor-styles.css";
import { RelativeTime } from "@/components/admin/dashboard/relative-time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { ArrowLeft, Eye, History, Loader2, Send, Sparkles } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

const lowlight = createLowlight(common);

type Status = "draft" | "review" | "scheduled" | "published" | "archived";

export type EditorInitial = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: unknown;
  status: Status;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  seo: { title?: string; description?: string; ogImage?: string } | null;
};

type Props = {
  initial: EditorInitial;
  workspaceSlug: string;
  revisions: RevisionItem[];
  bodyText: string;
};

const AUTOSAVE_MS = 1500;

export function EditorShell({ initial, workspaceSlug, revisions, bodyText }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial.title);
  const [side, setSide] = useState<SidePanelState>({
    slug: initial.slug,
    excerpt: initial.excerpt ?? "",
    scheduledAt: initial.scheduledAt ? toLocalDateTimeInput(initial.scheduledAt) : null,
    seo: {
      title: initial.seo?.title ?? "",
      description: initial.seo?.description ?? "",
      ogImage: initial.seo?.ogImage ?? "",
    },
  });
  const [status, setStatus] = useState<Status>(initial.status);
  const [savedState, setSavedState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const slashHandle = useRef<SlashController | null>(null);
  const slashCtrl = useSlashMenuController(slashHandle);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  const stateRef = useRef({ title, side });
  useEffect(() => {
    stateRef.current = { title, side };
  }, [title, side]);

  const slashExtension = useMemo(() => createSlashExtension(() => slashHandle.current), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Encabezado…";
          return "Empieza a escribir, o pulsa / para insertar un bloque";
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
      Highlight.configure({ multicolor: false }),
      Typography,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
      CharacterCount,
      slashExtension,
    ],
    content: initial.body ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "csm-editor-content",
      },
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const performSave = useCallback(async () => {
    if (!editor) return;
    setSavedState("saving");
    const snapshot = stateRef.current;
    try {
      const res = await saveEntryAction({
        id: initial.id,
        title: snapshot.title || "Sin título",
        slug: snapshot.side.slug,
        excerpt: snapshot.side.excerpt || null,
        body: editor.getJSON(),
        seo: {
          title: snapshot.side.seo.title,
          description: snapshot.side.seo.description,
          ogImage: snapshot.side.seo.ogImage || undefined,
        },
        scheduledAt: snapshot.side.scheduledAt
          ? new Date(snapshot.side.scheduledAt).toISOString()
          : null,
      });
      if (res.ok) {
        dirtyRef.current = false;
        setSavedState("saved");
        setSavedAt(res.updatedAt);
        if (res.slug !== snapshot.side.slug) {
          setSide((s) => ({ ...s, slug: res.slug }));
        }
        broadcast("saved", res.updatedAt);
        setRefreshKey((k) => k + 1);
      } else {
        setSavedState("error");
        toast.error(res.error);
      }
    } catch (err) {
      setSavedState("error");
      toast.error("No se pudo guardar");
      console.error(err);
    }
  }, [editor, initial.id]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSavedState("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void performSave();
    }, AUTOSAVE_MS);
  }, [performSave]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      scheduleSave();
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, scheduleSave]);

  function onTitleChange(e: FormEvent<HTMLTextAreaElement>) {
    const v = (e.target as HTMLTextAreaElement).value;
    setTitle(v);
    scheduleSave();
  }

  function onSideChange(next: Partial<SidePanelState>) {
    setSide((s) => {
      const merged: SidePanelState = {
        ...s,
        ...next,
        seo: next.seo ?? s.seo,
      };
      return merged;
    });
    scheduleSave();
  }

  // Save before unload if dirty
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Auto-resize title on mount and whenever the title changes (not just on user input)
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(`csm:preview:${initial.id}`);
    bcRef.current = bc;
    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [initial.id]);

  function broadcast(type: string, at?: string | number) {
    bcRef.current?.postMessage({ type, at: at ?? Date.now() });
  }

  // Status actions
  function publishNow() {
    startTransition(async () => {
      // Save first
      if (dirtyRef.current) await performSave();
      const res = await publishEntriesAction({ ids: [initial.id] });
      if (res.ok) {
        toast.success("Publicado");
        setStatus("published");
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo publicar");
      }
    });
  }

  function unpublishNow() {
    startTransition(async () => {
      const res = await unpublishEntriesAction({ ids: [initial.id] });
      if (res.ok) {
        toast.success("Pasado a borrador");
        setStatus("draft");
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo despublicar");
      }
    });
  }

  function archiveNow() {
    startTransition(async () => {
      const res = await archiveEntriesAction({ ids: [initial.id] });
      if (res.ok) {
        toast.success("Archivado");
        setStatus("archived");
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo archivar");
      }
    });
  }

  function scheduleNow() {
    if (!side.scheduledAt) return;
    startTransition(async () => {
      if (dirtyRef.current) await performSave();
      const res = await scheduleEntryAction({
        id: initial.id,
        scheduledAt: new Date(side.scheduledAt as string).toISOString(),
      });
      if (res.ok) {
        toast.success("Programado");
        setStatus("scheduled");
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo programar");
      }
    });
  }

  // ⌘S manual save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        void performSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [performSave]);

  // ⌘J abre AI Inline (gestionado por <AIInlinePopover />)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("csm:ai-inline:open"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Listener: insertar imagen elegida en el MediaPicker.
  useEffect(() => {
    if (!editor) return;
    function onInsert(e: Event) {
      const detail = (
        e as CustomEvent<{
          src: string;
          alt: string;
          focalX: number;
          focalY: number;
        }>
      ).detail;
      if (!detail?.src) return;
      editor!
        .chain()
        .focus()
        .setImage({
          src: detail.src,
          alt: detail.alt || undefined,
        })
        .run();
    }
    window.addEventListener("csm:media-picker:insert", onInsert as EventListener);
    return () => window.removeEventListener("csm:media-picker:insert", onInsert as EventListener);
  }, [editor]);

  const wordCount = editor?.storage.characterCount.words() ?? 0;
  const charCount = editor?.storage.characterCount.characters() ?? 0;
  const readingTime = Math.max(1, Math.round(wordCount / 220));

  const previewSrc = `/preview/${initial.id}`;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 px-3 py-2 backdrop-blur md:px-5">
        <Button variant="ghost" size="sm" asChild className="rounded-lg">
          <NextLink href="/admin/contenido">
            <ArrowLeft className="size-4" /> Contenido
          </NextLink>
        </Button>
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">
          {workspaceSlug}/posts/{side.slug}
        </span>

        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
          <SaveIndicator state={savedState} savedAt={savedAt} />
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRevisionsOpen(true)}
          className="rounded-lg"
        >
          <History className="size-4" /> Historial
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPreviewOpen((v) => !v)}
          className={cn("rounded-lg", previewOpen && "bg-primary/15 text-primary")}
        >
          <Eye className="size-4" /> Vista previa
        </Button>
        {status === "published" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={unpublishNow}
            disabled={pending}
            className="rounded-lg"
          >
            A borrador
          </Button>
        ) : (
          <Button
            variant="gradient"
            size="sm"
            onClick={publishNow}
            disabled={pending}
            className="rounded-lg"
          >
            <Send className="size-4" /> Publicar
          </Button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 overflow-hidden">
          <section className="flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-10 md:px-8">
              <textarea
                ref={titleRef}
                value={title}
                onChange={onTitleChange}
                rows={1}
                placeholder="Sin título"
                className="block w-full resize-none border-0 bg-transparent font-display text-4xl font-bold leading-tight tracking-tight focus:outline-none md:text-5xl"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "0px";
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{wordCount} palabras</span>
                <span>·</span>
                <span>{charCount} caracteres</span>
                <span>·</span>
                <span>{readingTime} min lectura</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("csm:ai-inline:open"))}
                  className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="size-3" /> ⌘J · AI Inline
                </button>
                <span>·</span>
                <VoiceDictation editor={editor} />
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    void performSave();
                  }}
                  className="rounded-md bg-muted/40 px-2 py-0.5 text-muted-foreground hover:text-foreground"
                >
                  ⌘S · Guardar
                </button>
              </div>
              <div className="mt-8 csm-editor">
                <EditorContent editor={editor} />
              </div>
              {editor ? <BubbleToolbar editor={editor} /> : null}
            </div>
          </section>
          {previewOpen ? (
            <PreviewPane
              src={previewSrc}
              refreshKey={refreshKey}
              onClose={() => setPreviewOpen(false)}
            />
          ) : null}
        </main>
        <SidePanel
          status={status}
          state={side}
          onChange={onSideChange}
          onPublish={publishNow}
          onUnpublish={unpublishNow}
          onSchedule={scheduleNow}
          onArchive={archiveNow}
          publishPath={`/blog/${side.slug}`}
          pending={pending}
          entryId={initial.id}
          title={title}
          bodyText={bodyText}
          editor={editor}
        />
      </div>

      <SlashPopup state={slashCtrl.state} index={slashCtrl.index} setIndex={slashCtrl.setIndex} />

      <RevisionsPanel
        entryId={initial.id}
        revisions={revisions}
        currentText={bodyText}
        open={revisionsOpen}
        onOpenChange={setRevisionsOpen}
      />

      <MediaPicker />

      <AIInlinePopover editor={editor} />
    </div>
  );
}

function SaveIndicator({
  state,
  savedAt,
}: {
  state: "saved" | "saving" | "dirty" | "error";
  savedAt: string;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Guardando…
      </span>
    );
  }
  if (state === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 text-warning">
        <span className="size-1.5 rounded-full bg-warning" /> Cambios sin guardar
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" /> Error al guardar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full bg-success" />
      <RelativeTime prefix="Guardado" date={savedAt} />
    </span>
  );
}

/**
 * Convierte un ISO UTC a `YYYY-MM-DDTHH:mm` interpretado en hora **local**.
 * `<input type="datetime-local">` espera ese formato y lo trata como local;
 * usar `toISOString().slice(0,16)` produciría un desfase igual al offset del usuario.
 */
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
