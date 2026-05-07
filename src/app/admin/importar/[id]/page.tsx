import { db } from "@/db/client";
import { collections, importItems, imports } from "@/db/schema";
import { SOURCE_LABELS, getParser } from "@/imports/registry";
import type { DescribeResult } from "@/imports/types";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { currentStorage } from "@/storage";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Wizard de import · techx" };
export const dynamic = "force-dynamic";

export default async function ImportDetail(props: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace("editor");
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  if (!db) notFound();

  const [row] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) notFound();

  const colls = await db
    .select({ id: collections.id, name: collections.name, slug: collections.slug })
    .from(collections)
    .where(eq(collections.workspaceId, ctx.workspace.id))
    .orderBy(asc(collections.name));

  const items = await db
    .select()
    .from(importItems)
    .where(eq(importItems.importId, id))
    .orderBy(desc(importItems.createdAt))
    .limit(100);

  // Re-describe del archivo (para preview en el wizard sin guardarlo en DB)
  let describe: DescribeResult | null = null;
  if (row.fileKey) {
    try {
      const buf = await currentStorage().get(row.fileKey);
      if (buf) {
        const parser = getParser(row.source);
        describe = await parser.describe(buf);
      }
    } catch {
      describe = null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {SOURCE_LABELS[row.source]} · Wizard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{row.fileName ?? "Sin nombre"}</h1>
      </header>
      <Wizard initialRow={row} describe={describe} collections={colls} items={items} />
    </div>
  );
}
