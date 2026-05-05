import { listEntriesForBranch, resolvePreviewBranch } from "@/branches";
import { db } from "@/db/client";
import { collections, workspaces } from "@/db/schema";
import { POSTS_SLUG } from "@/lib/entries";
import { renderDoc } from "@/lib/render-doc";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, GitBranch } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreviewEntry({
  params,
}: {
  params: Promise<{ token: string; slug: string }>;
}) {
  const { token, slug } = await params;
  // L30: password sólo desde cookie scoped, nunca desde query.
  const cookieStore = await cookies();
  const password = cookieStore.get(`csm_branch_preview_${token}`)?.value ?? null;
  const result = await resolvePreviewBranch({ token, password });
  if ("reason" in result) notFound();
  const branch = result.branch;
  if (!db) notFound();

  const [ws] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, branch.workspaceId))
    .limit(1);
  if (!ws) notFound();

  const [postsCol] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.workspaceId, ws.id), eq(collections.slug, POSTS_SLUG)))
    .limit(1);

  const rows = await listEntriesForBranch({
    workspaceId: ws.id,
    branch,
    collectionId: postsCol?.id,
  });
  // Buscar match por slug "limpio" (sin sufijo COW) o slug exacto.
  const found = rows.find(({ entry }) => {
    const cleanSlug = entry.slug.replace(/__b-[^/]+$/, "");
    return cleanSlug === slug || entry.slug === slug;
  });
  if (!found) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div
        className="sticky top-0 z-30 -mx-6 mb-6 flex items-center gap-2 border-b bg-card/80 px-6 py-2 text-xs backdrop-blur"
        style={{
          borderImage: `linear-gradient(90deg, ${branch.color ?? "oklch(0.55 0.22 290)"}, transparent) 1`,
        }}
      >
        <span
          className="size-2 rounded-full"
          style={{ background: branch.color ?? "oklch(0.55 0.22 290)" }}
          aria-hidden
        />
        <GitBranch className="size-3.5 text-primary" />
        <span>
          Preview de <strong>{branch.name}</strong> · solo lectura
        </span>
        <Link
          href={`/preview/branch/${token}`}
          className="ml-auto inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 hover:bg-muted"
        >
          <ArrowLeft className="size-3" />
          Volver
        </Link>
      </div>
      <article className="prose prose-zinc max-w-none dark:prose-invert">
        <h1 className="mb-2">{found.entry.title}</h1>
        {found.entry.excerpt ? (
          <p className="text-lg text-muted-foreground">{found.entry.excerpt}</p>
        ) : null}
        <hr className="my-6" />
        {renderDoc(found.entry.body)}
      </article>
    </main>
  );
}
