import {
  buildMergePlan,
  getBranchById,
  listBranchActivity,
  listBranchComments,
  listBranchConflicts,
  listEntriesForBranch,
  resolveActiveBranch,
} from "@/branches";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowLeft, GitBranch, Lock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchDetailClient } from "./client";

export const metadata: Metadata = { title: "Branch · CSM" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Activa",
  merging: "Merging",
  merged: "Mergeada",
  abandoned: "Abandonada",
};

export default async function BranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireWorkspace("viewer");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const branch = await getBranchById(ctx.workspace.id, id);
  if (!branch) notFound();

  const active = await resolveActiveBranch(ctx.workspace.id);
  const isActive = active.id === branch.id;
  const isMain = branch.isDefault;

  const [entryRows, conflicts, plan, activity, comments] = await Promise.all([
    listEntriesForBranch({
      workspaceId: ctx.workspace.id,
      branch,
      includeTombstones: true,
    }),
    isMain
      ? Promise.resolve([])
      : listBranchConflicts({ workspaceId: ctx.workspace.id, branchId: branch.id }),
    isMain
      ? Promise.resolve(null)
      : buildMergePlan({ workspaceId: ctx.workspace.id, branchId: branch.id }),
    listBranchActivity({ workspaceId: ctx.workspace.id, branchId: branch.id, limit: 50 }),
    listBranchComments({ workspaceId: ctx.workspace.id, branchId: branch.id }),
  ]);

  // H4: lookup acotado a sólo los originalIds — antes hacía full scan del workspace.
  const originalIds = entryRows
    .map((e) => e.entry.originalEntryId)
    .filter((id): id is string => !!id);
  const originalsMap = new Map<string, { title: string; updatedAt: Date }>();
  if (db && originalIds.length > 0) {
    const origs = await db
      .select({ id: entries.id, title: entries.title, updatedAt: entries.updatedAt })
      .from(entries)
      .where(and(eq(entries.workspaceId, ctx.workspace.id), inArray(entries.id, originalIds)));
    for (const o of origs) {
      originalsMap.set(o.id, { title: o.title, updatedAt: o.updatedAt });
    }
  }

  const conflictForkIds = new Set(conflicts.map((c) => c.forkId));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8">
      <Link
        href="/admin/branches"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Volver
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="flex items-start gap-4">
          <span
            className="mt-1 size-4 shrink-0 rounded-full"
            style={{ background: branch.color ?? "oklch(0.55 0.22 290)" }}
            aria-hidden
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{branch.name}</h1>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {branch.slug}
              </code>
              <Badge>{STATUS_LABEL[branch.status]}</Badge>
              {branch.isProtected ? (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Lock className="size-3" />
                  protegida
                </Badge>
              ) : null}
              {!isMain && (
                <Link
                  href={`/admin/branches/${branch.id}/protection`}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Configurar reglas de protección antes del merge"
                >
                  <Lock className="size-3" />
                  Reglas
                </Link>
              )}
              {isActive ? (
                <Badge className="gap-1 bg-primary/15 text-primary text-[10px]">
                  <Sparkles className="size-3" />
                  activa
                </Badge>
              ) : null}
            </div>
            {branch.description ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{branch.description}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Creada el {new Date(branch.createdAt).toLocaleDateString("es-ES")}</span>
              {branch.previewToken ? (
                <span className="text-primary">{branch.previewViews} previews</span>
              ) : null}
            </div>
          </div>
        </div>
        <BranchDetailClient
          branch={branch}
          isActive={isActive}
          plan={plan}
          conflictsCount={conflicts.length}
          openCommentsCount={comments.filter((c) => c.status === "open").length}
        />
      </header>

      {isMain ? (
        <section className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-6">
          <div className="flex items-center gap-3">
            <GitBranch className="size-6 text-emerald-700 dark:text-emerald-400" />
            <div>
              <p className="font-medium">Ésta es tu branch principal</p>
              <p className="text-sm text-muted-foreground">
                Contiene todo el contenido publicado. No es mergeable ni borrable.
                {entryRows.length > 0 ? ` Tiene ${entryRows.length} entradas.` : null}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <BranchDetailClient.Entries
          branchId={branch.id}
          rows={entryRows.map(({ entry, visibility }) => ({
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            status: entry.status,
            updatedAt: entry.updatedAt.toISOString(),
            visibility,
            originalEntryId: entry.originalEntryId,
            isConflict: conflictForkIds.has(entry.id),
            originalTitle: entry.originalEntryId
              ? (originalsMap.get(entry.originalEntryId)?.title ?? null)
              : null,
          }))}
        />
      )}

      <BranchDetailClient.ActivityAndComments
        activity={activity.map((a) => ({
          id: a.id,
          type: a.type,
          createdAt: a.createdAt.toISOString(),
          actorName: a.actor?.name ?? "Sistema",
          actorImage: a.actor?.image ?? null,
          payload: a.payload as Record<string, unknown> | null,
        }))}
        comments={comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          status: c.status,
          authorName: c.author?.name ?? "Anónimo",
          authorImage: c.author?.image ?? null,
          entryId: c.entryId,
          parentId: c.parentId,
        }))}
        branchId={branch.id}
      />
    </div>
  );
}
