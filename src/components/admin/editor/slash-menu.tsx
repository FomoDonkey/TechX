"use client";

import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Sparkles,
  Table as TableIcon,
  Type,
} from "lucide-react";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type SlashItem = {
  key: string;
  title: string;
  desc: string;
  icon: ReactElement;
  keywords?: string[];
  command: (params: { editor: Editor; range: Range }) => void;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    key: "p",
    title: "Texto",
    desc: "Párrafo simple",
    icon: <Type className="size-4" />,
    keywords: ["texto", "parrafo", "p"],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    key: "h1",
    title: "Encabezado 1",
    desc: "Título grande de sección",
    icon: <Heading1 className="size-4" />,
    keywords: ["heading", "h1", "titulo"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    key: "h2",
    title: "Encabezado 2",
    desc: "Subtítulo",
    icon: <Heading2 className="size-4" />,
    keywords: ["heading", "h2"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    key: "h3",
    title: "Encabezado 3",
    desc: "Sección secundaria",
    icon: <Heading3 className="size-4" />,
    keywords: ["heading", "h3"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    key: "ul",
    title: "Lista con viñetas",
    desc: "Lista desordenada",
    icon: <List className="size-4" />,
    keywords: ["lista", "bullet", "ul"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    key: "ol",
    title: "Lista numerada",
    desc: "Lista ordenada",
    icon: <ListOrdered className="size-4" />,
    keywords: ["lista", "ordenada", "ol"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    key: "task",
    title: "Lista de tareas",
    desc: "Checkboxes interactivos",
    icon: <ListChecks className="size-4" />,
    keywords: ["task", "todo", "checkbox"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    key: "quote",
    title: "Cita",
    desc: "Bloque destacado",
    icon: <Quote className="size-4" />,
    keywords: ["quote", "blockquote", "cita"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    key: "code",
    title: "Bloque de código",
    desc: "Con resaltado de sintaxis",
    icon: <Code className="size-4" />,
    keywords: ["code", "codigo", "snippet"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    key: "hr",
    title: "Divisor",
    desc: "Línea horizontal",
    icon: <Minus className="size-4" />,
    keywords: ["hr", "divider", "linea"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    key: "table",
    title: "Tabla",
    desc: "3 × 3 con cabecera",
    icon: <TableIcon className="size-4" />,
    keywords: ["table", "tabla"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    key: "image",
    title: "Imagen",
    desc: "Biblioteca, subir, URL o generar IA",
    icon: <ImageIcon className="size-4" />,
    keywords: ["image", "imagen", "foto", "media", "medios"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent("csm:media-picker:open"));
    },
  },
  {
    key: "ai",
    title: "AI Inline · ⌘J",
    desc: "Continuar, mejorar, traducir… (Fase 6)",
    icon: <Sparkles className="size-4" />,
    keywords: ["ai", "ia", "inteligencia"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent("csm:ai-inline:open"));
    },
  },
];

function filter(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.title.toLowerCase().includes(q) ||
      it.desc.toLowerCase().includes(q) ||
      it.keywords?.some((k) => k.includes(q)),
  );
}

export type SlashController = {
  open: (state: SlashState) => void;
  update: (state: SlashState) => void;
  close: () => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
};

export type SlashState = {
  query: string;
  items: SlashItem[];
  clientRect: () => DOMRect | null;
  command: (item: SlashItem) => void;
};

export function createSlashExtension(getController: () => SlashController | null) {
  return Extension.create({
    name: "csmSlashMenu",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          allowSpaces: false,
          items: ({ query }) => filter(SLASH_ITEMS, query),
          render: () => ({
            onStart: (props) => {
              getController()?.open({
                query: props.query,
                items: props.items as SlashItem[],
                clientRect: props.clientRect ?? (() => null),
                command: (item) => props.command(item),
              });
            },
            onUpdate: (props) => {
              getController()?.update({
                query: props.query,
                items: props.items as SlashItem[],
                clientRect: props.clientRect ?? (() => null),
                command: (item) => props.command(item),
              });
            },
            onKeyDown: (props) => getController()?.onKeyDown(props.event) ?? false,
            onExit: () => {
              getController()?.close();
            },
          }),
          command: ({ editor, range, props }) => {
            (props as SlashItem).command({ editor, range });
          },
        }),
      ];
    },
  });
}

type PopupHandle = SlashController;

export function useSlashMenuController(handleRef: React.MutableRefObject<PopupHandle | null>) {
  const [state, setState] = useState<SlashState | null>(null);
  const [index, setIndex] = useState(0);
  const stateRef = useRef<SlashState | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const open = useCallback((s: SlashState) => {
    setState(s);
    setIndex(0);
  }, []);
  const update = useCallback((s: SlashState) => {
    setState(s);
    setIndex((i) => (s.items.length > 0 ? Math.min(i, s.items.length - 1) : 0));
  }, []);
  const close = useCallback(() => setState(null), []);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    const cur = stateRef.current;
    if (!cur) return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => (cur.items.length === 0 ? 0 : (i + 1) % cur.items.length));
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => (cur.items.length === 0 ? 0 : (i - 1 + cur.items.length) % cur.items.length));
      return true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = cur.items[indexRef.current];
      if (item) cur.command(item);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setState(null);
      return true;
    }
    return false;
  }, []);

  useImperativeHandle(handleRef, () => ({ open, update, close, onKeyDown }), [
    open,
    update,
    close,
    onKeyDown,
  ]);

  return { state, index, setIndex };
}

export function SlashPopup({
  state,
  index,
  setIndex,
}: {
  state: SlashState | null;
  index: number;
  setIndex: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!state || !ref.current) return;
    const rect = state.clientRect();
    if (!rect) return;
    const el = ref.current;
    const PAD = 8;
    el.style.position = "fixed";

    // Posiciona debajo del cursor; si no cabe, lo flipa arriba.
    const popupH = el.offsetHeight;
    const popupW = el.offsetWidth;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const wantsTop = rect.bottom + PAD + popupH > vh - 8;
    const top = wantsTop ? Math.max(8, rect.top - PAD - popupH) : rect.bottom + PAD;
    const left = Math.min(Math.max(8, rect.left), vw - popupW - 8);

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [state]);

  if (!state || state.items.length === 0) return null;

  return (
    <div
      ref={ref}
      className="z-[120] w-72 overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1 shadow-xl shadow-black/30 backdrop-blur"
    >
      <p className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Insertar bloque
      </p>
      <ul className="max-h-72 overflow-y-auto">
        {state.items.map((it, i) => (
          <li key={it.key}>
            <button
              type="button"
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                state.command(it);
              }}
              data-active={i === index ? "true" : undefined}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors data-[active=true]:bg-primary/12"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-muted/60 text-muted-foreground data-[active=true]:bg-primary/15 data-[active=true]:text-primary">
                {it.icon}
              </span>
              <span className="flex-1">
                <span className="block font-medium leading-tight">{it.title}</span>
                <span className="block text-xs text-muted-foreground">{it.desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
