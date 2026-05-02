import { listApprovedForEntry } from "@/lib/comments";
import { CommentForm } from "./comment-form";

type Props = { entryId: string; slug: string };

export async function CommentsSection({ entryId, slug }: Props) {
  const items = await listApprovedForEntry(entryId);

  // Estructura tipo árbol (parent → children).
  // Si un parent fue eliminado/spam-marked y no aparece en items, el reply
  // se promociona a root para que no quede invisible.
  const idsPresent = new Set(items.map((i) => i.id));
  const byParent = new Map<string | null, typeof items>();
  for (const it of items) {
    const effectiveParent = it.parentId && idsPresent.has(it.parentId) ? it.parentId : null;
    const arr = byParent.get(effectiveParent) ?? [];
    arr.push(it);
    byParent.set(effectiveParent, arr);
  }
  const roots = byParent.get(null) ?? [];

  return (
    <section
      id="comentarios"
      className="mt-16 border-t border-[color:var(--th-border)] pt-10"
      aria-labelledby="comments-heading"
    >
      <div className="mb-6 flex items-baseline justify-between">
        <h2
          id="comments-heading"
          className="text-2xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--th-font-display)" }}
        >
          Comentarios
        </h2>
        <span className="text-sm text-[color:var(--th-fg-subtle)]">
          {items.length} {items.length === 1 ? "comentario" : "comentarios"}
        </span>
      </div>

      {roots.length === 0 ? (
        <p className="mb-6 text-[color:var(--th-fg-muted)]">
          Todavía no hay comentarios. Sé el primero en compartir tu opinión.
        </p>
      ) : (
        <ul className="mb-10 space-y-6">
          {roots.map((c) => (
            <CommentNode key={c.id} comment={c} childrenMap={byParent} />
          ))}
        </ul>
      )}

      <CommentForm slug={slug} />
    </section>
  );
}

function CommentNode({
  comment,
  childrenMap,
}: {
  comment: {
    id: string;
    authorName: string;
    authorImage: string | null;
    body: string;
    createdAt: Date;
  };
  childrenMap: Map<
    string | null,
    Array<{
      id: string;
      parentId: string | null;
      authorName: string;
      authorImage: string | null;
      body: string;
      createdAt: Date;
    }>
  >;
}) {
  const replies = childrenMap.get(comment.id) ?? [];
  return (
    <li className="rounded-[var(--th-radius-lg)] border border-[color:var(--th-border)] bg-[color:var(--th-surface)] p-4">
      <div className="flex items-baseline gap-3">
        <strong className="text-sm">{comment.authorName}</strong>
        <time
          className="text-xs text-[color:var(--th-fg-subtle)]"
          dateTime={new Date(comment.createdAt).toISOString()}
        >
          {new Date(comment.createdAt).toLocaleDateString("es-ES")}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[color:var(--th-fg-muted)]">{comment.body}</p>
      {replies.length > 0 ? (
        <ul className="mt-4 space-y-3 border-l border-[color:var(--th-border)] pl-4">
          {replies.map((r) => (
            <CommentNode key={r.id} comment={r} childrenMap={childrenMap} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
