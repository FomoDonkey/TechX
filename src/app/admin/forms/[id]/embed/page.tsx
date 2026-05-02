import { Badge } from "@/components/ui/badge";
import { getFormById } from "@/forms/lib";
import { requireWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { EmbedClient } from "./client";

export const dynamic = "force-dynamic";

export default async function FormEmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("editor");
  const form = await getFormById(ctx.workspace.id, id);
  if (!form) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6 space-y-5">
      <div className="rounded-2xl border bg-card/30 p-5 space-y-2">
        <h2 className="text-sm font-semibold">URL pública</h2>
        <code className="block rounded-lg bg-muted px-3 py-2 text-xs font-mono">
          /forms/{form.slug}
        </code>
        <p className="text-[11px] text-muted-foreground">
          Status:{" "}
          {form.status === "published" ? (
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px]">
              Publicado v{form.version}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {form.status}
            </Badge>
          )}{" "}
          — el form solo es accesible públicamente cuando está publicado.
        </p>
      </div>
      <EmbedClient slug={form.slug} />
    </div>
  );
}
