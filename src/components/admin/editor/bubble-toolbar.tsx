"use client";

import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
} from "lucide-react";

export function BubbleToolbar({ editor }: { editor: Editor }) {
  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      className="z-[110] flex items-center gap-0.5 rounded-xl border border-border/70 bg-popover/95 px-1 py-1 shadow-xl shadow-black/20 backdrop-blur"
    >
      <Btn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Negrita"
        kbd="⌘B"
      >
        <Bold className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Cursiva"
        kbd="⌘I"
      >
        <Italic className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Subrayado"
        kbd="⌘U"
      >
        <UnderlineIcon className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="Tachado"
      >
        <Strikethrough className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        label="Resaltar"
      >
        <Highlighter className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Inline code"
      >
        <Code className="size-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border/70" />
      <Btn
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="H1"
      >
        <Heading1 className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="H2"
      >
        <Heading2 className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="H3"
      >
        <Heading3 className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Lista"
      >
        <List className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Lista numerada"
      >
        <ListOrdered className="size-4" />
      </Btn>
      <Btn
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="Cita"
      >
        <Quote className="size-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border/70" />
      <Btn active={editor.isActive("link")} onClick={setLink} label="Enlace">
        <LinkIcon className="size-4" />
      </Btn>
      {editor.isActive("link") ? (
        <Btn onClick={() => editor.chain().focus().unsetLink().run()} label="Quitar enlace">
          <Unlink className="size-4" />
        </Btn>
      ) : null}
    </BubbleMenu>
  );
}

function Btn({
  children,
  onClick,
  active,
  label,
  kbd,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
  kbd?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={kbd ? `${label} (${kbd})` : label}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
        active && "bg-primary/15 text-primary",
      )}
    >
      {children}
    </button>
  );
}
