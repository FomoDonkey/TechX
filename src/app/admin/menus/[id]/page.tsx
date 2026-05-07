import { db } from "@/db/client";
import { collections, pages } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { getMenuById } from "@/menus/lib";
import type { MenuItem } from "@/menus/types";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuBuilder } from "./builder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar menú · techx" };

export default async function EditMenuPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await requireWorkspace("editor");
  const menu = await getMenuById(ctx.workspace.id, id);
  if (!menu) notFound();

  const [pageRows, collectionRows] = await Promise.all([
    db
      ? db
          .select({ id: pages.id, path: pages.path, title: pages.title })
          .from(pages)
          .where(and(eq(pages.workspaceId, ctx.workspace.id), eq(pages.status, "published")))
      : Promise.resolve([]),
    db
      ? db
          .select({ slug: collections.slug, name: collections.name })
          .from(collections)
          .where(eq(collections.workspaceId, ctx.workspace.id))
      : Promise.resolve([]),
  ]);

  const items = (menu.items as unknown as MenuItem[] | null) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/menus"
            className="rounded-lg border p-2 text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{menu.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">/menus/{menu.slug}</p>
          </div>
        </div>
      </header>
      <MenuBuilder
        id={menu.id}
        name={menu.name}
        description={menu.description ?? ""}
        location={menu.location}
        isDefault={menu.isDefault}
        initialItems={items}
        availablePages={pageRows}
        availableCollections={collectionRows}
      />
    </div>
  );
}
