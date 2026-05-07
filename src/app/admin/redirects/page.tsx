import { requireWorkspace } from "@/lib/workspace";
import { listRedirects } from "@/redirects/lib";
import { ArrowRightLeft } from "lucide-react";
import type { Metadata } from "next";
import { RedirectsClient } from "./client";

export const metadata: Metadata = { title: "Redirecciones · techx" };
export const dynamic = "force-dynamic";

export default async function RedirectsPage() {
  const ctx = await requireWorkspace("editor");
  const items = await listRedirects(ctx.workspace.id, { limit: 500 });
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ArrowRightLeft className="size-6 text-muted-foreground" /> Redirecciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Reglas <code className="rounded bg-muted px-1 py-0.5 text-xs">301/302/307/308</code> con
            match exacto, prefijo o regex. Importa desde CSV. Cambios en producción al instante.
          </p>
        </div>
      </header>
      <RedirectsClient initialItems={items} />
    </div>
  );
}
