import { cn } from "@/lib/utils";
import { Fragment, type ReactNode } from "react";

type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

type RenderOptions = {
  baseHeadingLevel?: 1 | 2;
};

/**
 * Combina padre+índice+tipo+slice del texto/longitud de contenido para que cada
 * key sea estable entre renders mientras el árbol no cambie. No es un puro array
 * index — incluye señal del nodo concreto, lo que evita falsos remounts y satisface
 * a Biome (noArrayIndexKey).
 */
function keyOf(parent: string, child: Node, i: number): string {
  const sig = child.text
    ? child.text.slice(0, 8)
    : child.content?.length
      ? `n${child.content.length}`
      : "";
  return `${parent}:${i}:${child.type}:${sig}`;
}

export function renderDoc(doc: unknown, opts: RenderOptions = {}): ReactNode {
  if (!doc || typeof doc !== "object") return null;
  const node = doc as Node;
  if (node.type !== "doc") return renderNode(node, opts, 0);
  return (
    <>
      {(node.content ?? []).map((c, i) => (
        <Fragment key={keyOf("doc", c, i)}>{renderNode(c, opts, i)}</Fragment>
      ))}
    </>
  );
}

function renderChildren(node: Node, opts: RenderOptions, parentTag: string): ReactNode {
  return (node.content ?? []).map((c, i) => (
    <Fragment key={keyOf(parentTag, c, i)}>{renderNode(c, opts, i)}</Fragment>
  ));
}

function renderNode(node: Node, opts: RenderOptions, _idx: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p
          className="my-4 text-base leading-7 text-foreground/90 md:text-lg"
          style={alignStyle(node)}
        >
          {renderInline(node)}
        </p>
      );
    case "heading": {
      const level = clampLevel((node.attrs?.level as number) ?? 2, opts.baseHeadingLevel ?? 2);
      const id = headingId(node);
      return headingTag(level, {
        id,
        children: renderInline(node),
        style: alignStyle(node),
      });
    }
    case "blockquote":
      return (
        <blockquote className="my-6 border-l-4 border-primary/60 bg-primary/5 px-5 py-3 italic text-foreground/85">
          {renderChildren(node, opts, "bq")}
        </blockquote>
      );
    case "bulletList":
      return (
        <ul className="my-4 list-disc space-y-2 pl-6 text-foreground/90">
          {renderChildren(node, opts, "ul")}
        </ul>
      );
    case "orderedList":
      return (
        <ol className="my-4 list-decimal space-y-2 pl-6 text-foreground/90">
          {renderChildren(node, opts, "ol")}
        </ol>
      );
    case "listItem":
      return <li>{renderChildren(node, opts, "li")}</li>;
    case "taskList":
      return <ul className="my-4 space-y-2 pl-0">{renderChildren(node, opts, "tl")}</ul>;
    case "taskItem": {
      const checked = node.attrs?.checked === true;
      return (
        <li className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mt-1.5 size-4 rounded border-border accent-primary"
            aria-label={checked ? "Hecho" : "Pendiente"}
          />
          <div className={cn(checked && "text-muted-foreground line-through")}>
            {renderChildren(node, opts, "ti")}
          </div>
        </li>
      );
    }
    case "codeBlock": {
      const language = (node.attrs?.language as string) || "plaintext";
      return (
        <pre className="my-6 overflow-x-auto rounded-2xl border border-border/60 bg-muted/40 p-5 text-sm">
          <code className={`language-${language} font-mono`}>
            {(node.content ?? []).map((c, i) => (
              <Fragment key={keyOf("cb", c, i)}>{c.text ?? ""}</Fragment>
            ))}
          </code>
        </pre>
      );
    }
    case "horizontalRule":
      return <hr className="my-10 border-t border-border/60" />;
    case "hardBreak":
      return <br />;
    case "image": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      const title = (node.attrs?.title as string) ?? undefined;
      return (
        <figure className="my-6">
          <img
            src={src}
            alt={alt}
            title={title}
            className="w-full rounded-2xl border border-border/40"
            loading="lazy"
          />
          {alt ? (
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              {alt}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "table":
      return (
        <div className="my-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>{renderChildren(node, opts, "tbl")}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr className="border-t border-border/40">{renderChildren(node, opts, "tr")}</tr>;
    case "tableHeader":
      return (
        <th
          colSpan={(node.attrs?.colspan as number) ?? 1}
          rowSpan={(node.attrs?.rowspan as number) ?? 1}
          className="bg-muted/40 px-3 py-2 text-left font-semibold"
        >
          {renderChildren(node, opts, "th")}
        </th>
      );
    case "tableCell":
      return (
        <td
          colSpan={(node.attrs?.colspan as number) ?? 1}
          rowSpan={(node.attrs?.rowspan as number) ?? 1}
          className="border border-border/40 px-3 py-2 align-top"
        >
          {renderChildren(node, opts, "td")}
        </td>
      );
    case "text":
      return renderText(node);
    default:
      if (node.content) {
        return renderChildren(node, opts, "fb");
      }
      return null;
  }
}

function renderInline(node: Node): ReactNode {
  return (node.content ?? []).map((c, i) => (
    <Fragment key={keyOf("in", c, i)}>{renderNode(c, {}, i)}</Fragment>
  ));
}

function renderText(node: Node): ReactNode {
  let result: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    result = wrapMark(result, mark);
  }
  return result;
}

function wrapMark(
  children: ReactNode,
  mark: { type: string; attrs?: Record<string, unknown> },
): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "underline":
      return <u>{children}</u>;
    case "strike":
      return <s>{children}</s>;
    case "code":
      return (
        <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em]">
          {children}
        </code>
      );
    case "highlight":
      return <mark className="rounded bg-accent/20 px-0.5 text-foreground">{children}</mark>;
    case "link": {
      const href = sanitizeUrl((mark.attrs?.href as string) ?? "#");
      const target = (mark.attrs?.target as string) ?? undefined;
      return (
        <a
          href={href}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          className="text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary"
        >
          {children}
        </a>
      );
    }
    case "textStyle":
      return <span style={{ color: (mark.attrs?.color as string) ?? undefined }}>{children}</span>;
    default:
      return children;
  }
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function sanitizeUrl(href: string): string {
  if (!href) return "#";
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const u = new URL(href);
    if (!SAFE_PROTOCOLS.has(u.protocol)) return "#";
    return u.toString();
  } catch {
    return "#";
  }
}

function clampLevel(level: number, base: 1 | 2): 1 | 2 | 3 | 4 | 5 | 6 {
  const lvl = Math.max(1, Math.min(6, level + (base - 1)));
  return lvl as 1 | 2 | 3 | 4 | 5 | 6;
}

function alignStyle(node: Node): React.CSSProperties | undefined {
  const align = node.attrs?.textAlign as string | undefined;
  if (!align || align === "left") return undefined;
  return { textAlign: align as React.CSSProperties["textAlign"] };
}

function headingTag(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  props: { id?: string; children: ReactNode; style?: React.CSSProperties },
): ReactNode {
  const baseClass = "scroll-mt-24 font-display font-semibold tracking-tight text-foreground";
  const sizeClass: Record<number, string> = {
    1: "mt-10 mb-4 text-3xl md:text-4xl",
    2: "mt-9 mb-3 text-2xl md:text-3xl",
    3: "mt-7 mb-3 text-xl md:text-2xl",
    4: "mt-6 mb-2 text-lg md:text-xl",
    5: "mt-5 mb-2 text-base md:text-lg",
    6: "mt-4 mb-2 text-sm uppercase tracking-wider",
  };
  const className = cn(baseClass, sizeClass[level]);
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <Tag id={props.id} className={className} style={props.style}>
      {props.children}
    </Tag>
  );
}

export function headingId(node: Node): string | undefined {
  const text = collectText(node).trim();
  if (!text) return undefined;
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

function collectText(node: Node): string {
  if (typeof node.text === "string") return node.text;
  if (!node.content) return "";
  return node.content.map(collectText).join("");
}

export type TocItem = { level: number; text: string; id: string };

export function buildToc(doc: unknown, baseHeadingLevel: 1 | 2 = 2): TocItem[] {
  if (!doc || typeof doc !== "object") return [];
  const out: TocItem[] = [];
  const visit = (node: Node) => {
    if (node.type === "heading") {
      const level = clampLevel((node.attrs?.level as number) ?? 2, baseHeadingLevel);
      const id = headingId(node);
      const text = collectText(node).trim();
      if (id && text && level <= 4) out.push({ level, text, id });
    }
    if (node.content) for (const c of node.content) visit(c);
  };
  visit(doc as Node);
  return out;
}

export function readingTimeMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
