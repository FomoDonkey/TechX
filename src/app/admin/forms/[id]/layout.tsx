import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFormById } from "@/forms/lib";
import { requireWorkspace } from "@/lib/workspace";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TabsNav } from "./tabs-nav";

export const dynamic = "force-dynamic";

export default async function FormLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace("editor");
  const form = await getFormById(ctx.workspace.id, id);
  if (!form) notFound();
  const publicUrl = `/forms/${form.slug}`;
  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="border-b bg-card/30 px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/admin/forms">
              <ArrowLeft className="size-3.5" /> Formularios
            </Link>
          </Button>
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <h1 className="truncate text-base font-semibold">{form.name}</h1>
            {form.status === "published" ? (
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 text-[10px]">
                Publicado v{form.version}
              </Badge>
            ) : form.status === "draft" ? (
              <Badge variant="outline" className="text-[10px]">
                Borrador
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                Archivado
              </Badge>
            )}
          </div>
          {form.status === "published" ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Ver público
              </a>
            </Button>
          ) : null}
        </div>
        <div className="mx-auto mt-3 flex w-full max-w-6xl">
          <TabsNav id={id} />
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
