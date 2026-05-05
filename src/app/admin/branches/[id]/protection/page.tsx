import { getCurrentUser } from "@/auth/server";
import { getBranchById } from "@/branches";
import { evaluateBranchProtection } from "@/branches/protection";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/workspace";
import { ArrowLeft, GitBranch, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProtectionForm } from "./client";

export const metadata: Metadata = { title: "Protección · CSM" };
export const dynamic = "force-dynamic";

export default async function BranchProtectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await requireWorkspace("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const branch = await getBranchById(ctx.workspace.id, id);
  if (!branch) notFound();
  if (branch.isDefault) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
        <Link
          href={`/admin/branches/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver
        </Link>
        <Card className="space-y-2 p-6">
          <div className="flex items-center gap-3">
            <GitBranch className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Protección de main</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            La rama principal usa siempre <code>isProtected=true</code>: nadie puede borrarla ni
            mergear sobre ella. Las reglas avanzadas aplican a branches feature/hotfix.
          </p>
        </Card>
      </div>
    );
  }

  const evaluation = await evaluateBranchProtection(ctx.workspace.id, id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <Link
        href={`/admin/branches/${id}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Volver a la branch
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-violet-500" />
          <h1 className="text-2xl font-semibold tracking-tight">Protección de la branch</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Reglas que deben cumplirse antes de que esta branch pueda mergear a main.
          <br />
          Branch: <code className="rounded bg-muted px-1.5 py-0.5">{branch.slug}</code>
        </p>
      </header>

      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-medium">Estado actual</h2>
          <Badge variant={evaluation.ok ? "default" : "outline"}>
            {evaluation.ok
              ? "Mergeable"
              : `${evaluation.blockers.length} blocker${evaluation.blockers.length === 1 ? "" : "s"}`}
          </Badge>
        </div>
        {evaluation.blockers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No hay reglas pendientes. Si se aplica alguna regla y se cumple, queda en verde aquí.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {evaluation.blockers.map((b) => (
              <li key={b.rule} className="flex items-start gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-500" />
                <span>{b.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <ProtectionForm branchId={id} initial={evaluation.config} />
      </Card>

      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium">¿Cómo funciona?</p>
        <p className="mt-1">
          Cuando intentas mergear esta branch, antes de aplicar conflictos se evalúan estas reglas.
          Si alguna falla, el merge se rechaza con la lista de blockers. <strong>Force</strong> NO
          bypassa protección — si necesitas saltarte una regla, edita la configuración aquí (queda
          log en activity), o abandona y recrea la branch.
        </p>
      </div>
    </div>
  );
}
