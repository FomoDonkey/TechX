import { Button } from "@/components/ui/button";
import { getFormById, listSubmissions } from "@/forms/lib";
import type { FormSchema } from "@/forms/types";
import { requireWorkspace } from "@/lib/workspace";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmissionsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function FormSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireWorkspace("editor");
  const form = await getFormById(ctx.workspace.id, id);
  if (!form) notFound();

  const status =
    (sp.status as "received" | "spam" | "processed" | "archived" | undefined) ?? undefined;
  const search = sp.q?.trim() || undefined;

  const result = await listSubmissions({
    workspaceId: ctx.workspace.id,
    formId: id,
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    limit: 50,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/forms/${id}/submissions`} prefetch={false}>
            Todos
          </Link>
        </Button>
        {(["received", "processed", "archived", "spam"] as const).map((s) => (
          <Button key={s} asChild variant={status === s ? "default" : "ghost"} size="sm">
            <Link href={`/admin/forms/${id}/submissions?status=${s}`} prefetch={false}>
              {labelFor(s)}
            </Link>
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/admin/forms/${id}/submissions/export?format=csv`}>Descargar CSV</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/admin/forms/${id}/submissions/export?format=json`}>JSON</a>
          </Button>
        </div>
      </div>

      {result.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            {status
              ? `Sin envíos en estado "${labelFor(status as "received")}"`
              : "Sin envíos todavía. Comparte el form para empezar a recibir."}
          </p>
        </div>
      ) : (
        <SubmissionsClient
          rows={result.rows.map((r) => ({
            id: r.id,
            createdAt: r.createdAt.toISOString(),
            status: r.status,
            spamScore: r.spamScore,
            spamReasons: r.spamReasons ?? [],
            country: r.country,
            data: (r.data ?? {}) as Record<string, unknown>,
          }))}
          formSchema={(form.schema ?? null) as FormSchema | null}
        />
      )}
    </div>
  );
}

function labelFor(s: "received" | "spam" | "processed" | "archived"): string {
  switch (s) {
    case "received":
      return "Recibidas";
    case "spam":
      return "Spam";
    case "processed":
      return "Procesadas";
    case "archived":
      return "Archivadas";
  }
}
