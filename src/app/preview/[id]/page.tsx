import { requireUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { getEntryById } from "@/lib/entries";
import { buildToc, readingTimeMinutes, renderDoc } from "@/lib/render-doc";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";

export const metadata = { title: "Preview" };

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const ctx = await requireWorkspace("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const entry = await getEntryById(ctx.workspace.id, id);
  if (!entry) notFound();

  const toc = buildToc(entry.body);
  const reading = readingTimeMinutes(entry.bodyText ?? "");

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">PREVIEW</Badge>
        <Badge variant={entry.status === "published" ? "gradient" : "secondary"}>
          {entry.status}
        </Badge>
        <span>·</span>
        <span>
          /{ctx.workspace.slug}/blog/{entry.slug}
        </span>
        <span>·</span>
        <span>{reading} min lectura</span>
      </div>
      <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
        {entry.title || "Sin título"}
      </h1>
      {entry.excerpt ? (
        <p className="mt-4 text-lg text-muted-foreground md:text-xl">{entry.excerpt}</p>
      ) : null}

      {toc.length > 2 ? (
        <nav className="my-8 rounded-2xl border border-border/60 bg-card/40 p-5">
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Índice
          </p>
          <ul className="space-y-1.5 text-sm">
            {toc.map((it) => (
              <li
                key={it.id}
                className="text-muted-foreground hover:text-foreground"
                style={{ paddingLeft: `${(it.level - 2) * 12}px` }}
              >
                <a href={`#${it.id}`}>{it.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="prose-csm">{renderDoc(entry.body)}</div>
    </article>
  );
}
