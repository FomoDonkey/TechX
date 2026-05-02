import { EditorShell } from "@/components/admin/editor/editor-shell";
import { getEntryById, listLatestRevisions } from "@/lib/entries";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Editor" };
  const ctx = await requireWorkspace("viewer");
  const entry = await getEntryById(ctx.workspace.id, id);
  return { title: entry?.title ? `${entry.title} · Editor` : "Editor" };
}

function bodyToText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) for (const c of n.content) visit(c);
  };
  visit(body);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkspace("author");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const entry = await getEntryById(ctx.workspace.id, id);
  if (!entry) notFound();

  const revisions = (await listLatestRevisions(entry.id, 30)).map((r) => ({
    id: r.id,
    summary: r.summary,
    authorId: r.authorId,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <EditorShell
      initial={{
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        excerpt: entry.excerpt,
        body: entry.body,
        status: entry.status,
        scheduledAt: entry.scheduledAt ? entry.scheduledAt.toISOString() : null,
        publishedAt: entry.publishedAt ? entry.publishedAt.toISOString() : null,
        updatedAt: entry.updatedAt.toISOString(),
        seo: entry.seo,
      }}
      workspaceSlug={ctx.workspace.slug}
      revisions={revisions}
      bodyText={entry.bodyText ?? bodyToText(entry.body)}
    />
  );
}
