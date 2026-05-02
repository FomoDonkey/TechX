import { getFormById } from "@/forms/lib";
import type { FormSchema } from "@/forms/types";
import { requireWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { BuilderClient } from "./builder-client";

export const dynamic = "force-dynamic";

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("editor");
  const form = await getFormById(ctx.workspace.id, id);
  if (!form) notFound();
  return (
    <BuilderClient
      form={{
        id: form.id,
        name: form.name,
        slug: form.slug,
        description: form.description,
        status: form.status,
        version: form.version,
        schema: (form.schema ?? null) as FormSchema | null,
      }}
    />
  );
}
