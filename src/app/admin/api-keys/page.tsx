import { listKeysForWorkspace } from "@/api/keys";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { ApiKeysClient } from "./client";

export const metadata: Metadata = { title: "API keys · techx" };
export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const ctx = await requireWorkspace("admin");
  const keys = await listKeysForWorkspace(ctx.workspace.id);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Genera tokens para acceder al REST API de tu workspace. Las keys{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">live</code> mutan datos reales, las{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">test</code> simulan operaciones sin
          tocar la base.
        </p>
      </header>
      <ApiKeysClient
        workspaceSlug={ctx.workspace.slug}
        initialKeys={keys.map((k) => ({
          ...k,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
