import { bumpPreviewView, listEntriesForBranch, resolvePreviewBranch } from "@/branches";
import { db } from "@/db/client";
import { collections, workspaces } from "@/db/schema";
import { POSTS_SLUG } from "@/lib/entries";
import { and, eq } from "drizzle-orm";
import { GitBranch } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreviewPasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function PreviewIndex({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ retry?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  // L30: password viaja sólo en cookie httpOnly scoped por token (jamás en URL).
  const cookieStore = await cookies();
  const password = cookieStore.get(`csm_branch_preview_${token}`)?.value ?? null;
  const result = await resolvePreviewBranch({ token, password });

  if ("reason" in result) {
    if (result.reason === "password-required" || result.reason === "wrong-password") {
      return (
        <PreviewPasswordForm
          token={token}
          error={
            sp.retry === "1" || result.reason === "wrong-password"
              ? "Contraseña incorrecta o expirada"
              : null
          }
        />
      );
    }
    if (result.reason === "expired") {
      return <PreviewMessage title="Preview expirado" body="El propietario debe rotar el token." />;
    }
    if (result.reason === "branch-closed") {
      return <PreviewMessage title="Branch ya no activa" body="Fue mergeada o abandonada." />;
    }
    notFound();
  }

  const branch = result.branch;
  if (!db) notFound();

  // Bump views best-effort.
  void bumpPreviewView(branch.id).catch(() => {});

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

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <PreviewBadge branchName={branch.name} branchColor={branch.color} workspace={ws.name} />
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{ws.name}</h1>
        <p className="text-muted-foreground">
          Vista preview de la branch <strong>{branch.name}</strong>. Sólo lectura.
        </p>
      </header>
      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            La branch no tiene entradas todavía.
          </li>
        ) : (
          rows.map(({ entry, visibility }) => {
            const cleanSlug = entry.slug.replace(/__b-[^/]+$/, "");
            return (
              <li key={entry.id}>
                <Link
                  href={`/preview/branch/${token}/${cleanSlug}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border bg-card/30 p-4 transition-colors hover:border-primary/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.title || "Sin título"}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                          visibility === "new"
                            ? "bg-emerald-500/15 text-emerald-700"
                            : visibility === "forked"
                              ? "bg-amber-500/15 text-amber-700"
                              : visibility === "main"
                                ? "bg-muted text-muted-foreground"
                                : "bg-rose-500/15 text-rose-700"
                        }`}
                      >
                        {visibility}
                      </span>
                    </div>
                    {entry.excerpt ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{entry.excerpt}</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </main>
  );
}

function PreviewBadge({
  branchName,
  branchColor,
  workspace,
}: {
  branchName: string;
  branchColor: string | null;
  workspace: string;
}) {
  return (
    <div
      className="sticky top-0 z-30 -mx-6 mb-6 flex items-center gap-2 border-b bg-card/80 px-6 py-2 text-xs backdrop-blur"
      style={{
        borderImage: `linear-gradient(90deg, ${branchColor ?? "oklch(0.55 0.22 290)"}, transparent) 1`,
      }}
    >
      <span
        className="size-2 rounded-full"
        style={{ background: branchColor ?? "oklch(0.55 0.22 290)" }}
        aria-hidden
      />
      <GitBranch className="size-3.5 text-primary" />
      <span>
        Preview de <strong>{branchName}</strong> en {workspace} · solo lectura
      </span>
    </div>
  );
}

function PreviewMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6 py-10">
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}
