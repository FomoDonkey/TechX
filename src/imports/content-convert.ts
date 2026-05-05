/**
 * Conversores HTML / Markdown → Tiptap doc.
 *
 * Cubrimos los bloques más comunes en imports reales:
 *   - paragraph
 *   - heading (1-6)
 *   - bulletList / orderedList
 *   - blockquote
 *   - codeBlock
 *   - image (en figure)
 *   - hardBreak
 *
 * Para inline marks (strong, em, link, code) hacemos pase posterior con regex
 * sobre cada nodo de texto. No es perfecto pero produce contenido editable
 * razonable. El usuario puede ajustar luego en el editor.
 *
 * Seguridad: TODOS los `href` y `src` pasan por `isSafeUrl()` (mismo helper
 * que el editor de bloques). Bloquea `javascript:`, `data:`, control chars,
 * protocol-relative `//evil.com`, etc. Sin esto un import malicioso podría
 * inyectar XSS en cada page-view de la entry.
 */

import { isSafeUrl } from "@/blocks/registry";

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export type TiptapDoc = { type: "doc"; content: TiptapNode[] };

export const EMPTY_DOC: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function inlineToNodes(raw: string): TiptapNode[] {
  // Recursivo simple: <a href>, <strong>/<b>, <em>/<i>, <code>
  const nodes: TiptapNode[] = [];
  let rest = raw;
  while (rest.length > 0) {
    const linkM = /^([\s\S]*?)<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]*)$/i.exec(
      rest,
    );
    const strongM = /^([\s\S]*?)<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>([\s\S]*)$/i.exec(
      rest,
    );
    const emM = /^([\s\S]*?)<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>([\s\S]*)$/i.exec(rest);
    const codeM = /^([\s\S]*?)<code\b[^>]*>([\s\S]*?)<\/code>([\s\S]*)$/i.exec(rest);
    const matches = [
      linkM && { idx: linkM[1]?.length ?? 0, m: linkM, kind: "link" as const },
      strongM && { idx: strongM[1]?.length ?? 0, m: strongM, kind: "strong" as const },
      emM && { idx: emM[1]?.length ?? 0, m: emM, kind: "em" as const },
      codeM && { idx: codeM[1]?.length ?? 0, m: codeM, kind: "code" as const },
    ].filter((x): x is NonNullable<typeof x> => x !== null);
    if (matches.length === 0) {
      const text = stripTags(rest);
      if (text) nodes.push({ type: "text", text });
      break;
    }
    matches.sort((a, b) => a.idx - b.idx);
    const first = matches[0];
    if (!first) break;
    const before = first.m[1];
    const inner = first.m[first.kind === "link" ? 3 : 2];
    const tail = first.m[first.kind === "link" ? 4 : 3];
    if (before && stripTags(before)) nodes.push({ type: "text", text: stripTags(before) });
    const text = inner ? stripTags(inner) : "";
    if (text) {
      let mark: { type: string; attrs?: Record<string, unknown> } | null = null;
      if (first.kind === "link") {
        const href = first.m[2] ?? "";
        // Drop link mark si href no pasa whitelist — el texto persiste sin link
        if (isSafeUrl(href)) mark = { type: "link", attrs: { href } };
      } else if (first.kind === "strong") {
        mark = { type: "bold" };
      } else if (first.kind === "em") {
        mark = { type: "italic" };
      } else {
        mark = { type: "code" };
      }
      nodes.push(mark ? { type: "text", text, marks: [mark] } : { type: "text", text });
    }
    rest = tail ?? "";
  }
  return nodes.filter((n) => n.text);
}

function paragraph(raw: string): TiptapNode | null {
  const content = inlineToNodes(raw);
  if (content.length === 0) return null;
  return { type: "paragraph", content };
}

function heading(level: number, raw: string): TiptapNode | null {
  const content = inlineToNodes(raw);
  if (content.length === 0) return null;
  return { type: "heading", attrs: { level }, content };
}

function listItems(raw: string): TiptapNode[] {
  const out: TiptapNode[] = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  m = re.exec(raw);
  while (m !== null) {
    const inner = m[1] ?? "";
    const para = paragraph(inner);
    out.push({ type: "listItem", content: para ? [para] : [{ type: "paragraph" }] });
    m = re.exec(raw);
  }
  return out;
}

/**
 * HTML → Tiptap doc. Heurística por bloques top-level.
 */
export function htmlToTiptap(html: string): TiptapDoc {
  if (!html || html.trim() === "") return EMPTY_DOC;
  // Quita scripts/styles antes de procesar
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const blocks: TiptapNode[] = [];

  const blockRe =
    /<(h[1-6]|p|ul|ol|blockquote|pre|figure|hr|img)\b([^>]*)>([\s\S]*?)<\/\1>|<(hr|img)\b([^>]*)\s*\/?>/gi;

  let lastIndex = 0;
  let m: RegExpExecArray | null;
  m = blockRe.exec(cleaned);
  while (m !== null) {
    const beforeText = cleaned.slice(lastIndex, m.index);
    if (stripTags(beforeText)) {
      const para = paragraph(beforeText);
      if (para) blocks.push(para);
    }
    const tag = (m[1] ?? m[4] ?? "").toLowerCase();
    const inner = m[3] ?? "";
    const attrs = m[2] ?? m[5] ?? "";
    if (tag.startsWith("h") && tag.length === 2) {
      const level = Number.parseInt(tag.slice(1), 10);
      const node = heading(level, inner);
      if (node) blocks.push(node);
    } else if (tag === "p") {
      const node = paragraph(inner);
      if (node) blocks.push(node);
    } else if (tag === "ul" || tag === "ol") {
      const items = listItems(inner);
      if (items.length > 0) {
        blocks.push({ type: tag === "ul" ? "bulletList" : "orderedList", content: items });
      }
    } else if (tag === "blockquote") {
      const para = paragraph(inner);
      if (para) blocks.push({ type: "blockquote", content: [para] });
    } else if (tag === "pre") {
      const text = stripTags(inner);
      if (text) {
        blocks.push({ type: "codeBlock", content: [{ type: "text", text }] });
      }
    } else if (tag === "figure") {
      const imgM = /<img\b[^>]*src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?/i.exec(inner);
      if (imgM?.[1] && isSafeUrl(imgM[1])) {
        blocks.push({ type: "image", attrs: { src: imgM[1], alt: imgM[2] ?? "" } });
      }
    } else if (tag === "hr") {
      blocks.push({ type: "horizontalRule" });
    } else if (tag === "img") {
      const srcM = /src=["']([^"']+)["']/i.exec(attrs);
      const altM = /alt=["']([^"']*)["']/i.exec(attrs);
      if (srcM?.[1] && isSafeUrl(srcM[1])) {
        blocks.push({ type: "image", attrs: { src: srcM[1], alt: altM?.[1] ?? "" } });
      }
    }
    lastIndex = m.index + m[0].length;
    m = blockRe.exec(cleaned);
  }
  const tail = cleaned.slice(lastIndex);
  if (stripTags(tail)) {
    const para = paragraph(tail);
    if (para) blocks.push(para);
  }

  if (blocks.length === 0) return EMPTY_DOC;
  return { type: "doc", content: blocks };
}

/**
 * Markdown → Tiptap doc. Implementación mínima (no soporta tablas/footnotes).
 * Para casos complejos el usuario puede pegar el .md directamente en el
 * editor que tiene soporte built-in.
 */
export function markdownToTiptap(md: string): TiptapDoc {
  if (!md || md.trim() === "") return EMPTY_DOC;
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim() === "") {
      i++;
      continue;
    }

    // ATX heading
    const hM = /^(#{1,6})\s+(.+)$/.exec(line);
    if (hM) {
      const level = hM[1]?.length ?? 1;
      const text = hM[2] ?? "";
      blocks.push({
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text }],
      });
      i++;
      continue;
    }

    // Code fence
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith("```")) {
        code.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : undefined,
        content: [{ type: "text", text: code.join("\n") }],
      });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]?.startsWith("> ")) {
        quoteLines.push((lines[i] ?? "").slice(2));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: quoteLines.join(" ") }] }],
      });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i] ?? "")) {
        const text = (lines[i] ?? "").replace(/^[-*+]\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        });
        i++;
      }
      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        const text = (lines[i] ?? "").replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        });
        i++;
      }
      blocks.push({ type: "orderedList", content: items });
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Paragraph (collapse contiguous non-empty lines)
    const paraLines: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() !== "") {
      const cur = lines[i] ?? "";
      if (/^(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```)/.test(cur)) break;
      paraLines.push(cur);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: [{ type: "text", text: paraLines.join(" ") }],
      });
    }
  }

  if (blocks.length === 0) return EMPTY_DOC;
  return { type: "doc", content: blocks };
}

export function contentToBodyText(content: string): string {
  if (!content) return "";
  return stripTags(content).slice(0, 100_000);
}
