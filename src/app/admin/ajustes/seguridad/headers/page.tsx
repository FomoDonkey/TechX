import { getCurrentUser } from "@/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { cspReports } from "@/db/schema";
import { shouldEnforceCsp } from "@/lib/security-headers";
import { desc, isNull, sql } from "drizzle-orm";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResolveDirectiveButton, ResolveReportButton } from "./client";

export const metadata: Metadata = { title: "Cabeceras de seguridad · CSM" };
export const dynamic = "force-dynamic";

type DirectiveSummary = {
  violatedDirective: string;
  totalOccurrences: number;
  uniqueResources: number;
  lastSeen: Date;
};

type ReportRow = {
  id: string;
  violatedDirective: string;
  blockedUri: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  sample: string | null;
};

export default async function HeadersPage() {
  const user = await getCurrentUser();
  if (!user || !db) redirect("/login");

  // Sumarios por directiva (sólo unresolved).
  const summaryRows = (await db.execute(sql`
    SELECT
      violated_directive AS "violatedDirective",
      SUM(occurrences)::int AS "totalOccurrences",
      COUNT(DISTINCT blocked_uri)::int AS "uniqueResources",
      MAX(last_seen_at) AS "lastSeen"
    FROM csp_reports
    WHERE resolved_at IS NULL
    GROUP BY violated_directive
    ORDER BY MAX(last_seen_at) DESC
  `)) as unknown as { rows: DirectiveSummary[] };
  const summary = summaryRows.rows;

  // Top 50 reports unresolved más recientes para tabla detalle.
  const recent = (await db
    .select({
      id: cspReports.id,
      violatedDirective: cspReports.violatedDirective,
      blockedUri: cspReports.blockedUri,
      sourceFile: cspReports.sourceFile,
      lineNumber: cspReports.lineNumber,
      occurrences: cspReports.occurrences,
      firstSeenAt: cspReports.firstSeenAt,
      lastSeenAt: cspReports.lastSeenAt,
      sample: cspReports.sample,
    })
    .from(cspReports)
    .where(isNull(cspReports.resolvedAt))
    .orderBy(desc(cspReports.lastSeenAt))
    .limit(50)) as ReportRow[];

  const enforce = shouldEnforceCsp();
  const hasUnresolved = summary.length > 0;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Cabeceras de seguridad</h1>
        <p className="text-sm text-muted-foreground">
          CSP, HSTS, Permissions-Policy y reportes de violaciones del navegador.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-lg ${
              enforce ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
            }`}
          >
            {enforce ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="font-medium">
              CSP{" "}
              <Badge variant={enforce ? "default" : "outline"} className="ml-2">
                {enforce ? "Enforce" : "Report-Only"}
              </Badge>
            </h2>
            {enforce ? (
              <p className="text-sm text-muted-foreground">
                Activo: el navegador <strong>bloquea</strong> recursos que violen la política y
                reporta a <code className="text-xs">/api/security/csp-report</code>. Verifica los
                reportes recientes para asegurar que no rompes funcionalidad.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Modo telemetría: el navegador no bloquea, sólo reporta. Cuando la cola de reports
                  esté limpia (≥ 7 días sin nuevas violaciones), promociona a{" "}
                  <strong>enforce</strong> añadiendo <code className="text-xs">CSP_ENFORCE=1</code>{" "}
                  a las variables de entorno y redeploy.
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Vercel: Project Settings → Environment Variables → Production →{" "}
                  <code className="text-xs">CSP_ENFORCE=1</code>.
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Reportes por directiva</h2>
          <p className="text-xs text-muted-foreground">
            {hasUnresolved
              ? `${summary.length} directiva${summary.length === 1 ? "" : "s"} con violaciones sin resolver`
              : "Sin reportes pendientes"}
          </p>
        </div>

        {!hasUnresolved && (
          <Card className="flex items-center gap-3 p-5 text-sm">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <div>
              <p className="font-medium">Todo limpio.</p>
              <p className="text-muted-foreground">
                No hay violaciones CSP pendientes. Si llevas ≥ 7 días así, puedes pasar a enforce.
              </p>
            </div>
          </Card>
        )}

        {hasUnresolved && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Directiva</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Recursos únicos</th>
                  <th className="px-3 py-2 font-medium">Última violación</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.map((s) => (
                  <tr key={s.violatedDirective} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{s.violatedDirective}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {s.totalOccurrences.toLocaleString("es")}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{s.uniqueResources}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(s.lastSeen).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ResolveDirectiveButton directive={s.violatedDirective} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Detalle (últimos 50)</h2>
            <p className="text-xs text-muted-foreground">
              Cada fila representa un par directiva + recurso único.
            </p>
          </div>
          <div className="space-y-3">
            {recent.map((r) => (
              <Card key={r.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-baseline gap-2 text-xs">
                  <Badge variant="outline" className="font-mono">
                    {r.violatedDirective}
                  </Badge>
                  <span className="tabular-nums text-muted-foreground">
                    × {r.occurrences.toLocaleString("es")}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.lastSeenAt).toLocaleString("es-ES", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <ResolveReportButton reportId={r.id} />
                </div>
                {r.blockedUri && (
                  <div className="break-all font-mono text-xs">
                    <span className="text-muted-foreground">Recurso bloqueado: </span>
                    {r.blockedUri}
                  </div>
                )}
                {r.sourceFile && (
                  <div className="break-all font-mono text-xs text-muted-foreground">
                    {r.sourceFile}
                    {r.lineNumber ? `:${r.lineNumber}` : ""}
                  </div>
                )}
                {r.sample && (
                  <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs">{r.sample}</pre>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Otras cabeceras</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">HSTS</p>
            <p className="text-muted-foreground text-xs">
              <code>max-age=31536000; includeSubDomains</code> · Sólo en producción HTTPS. Preload
              deshabilitado (irreversible).
            </p>
          </Card>
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">Permissions-Policy</p>
            <p className="text-muted-foreground text-xs">
              Bloquea camera/geolocation/usb. Permite microphone(self) (voice-to-content) y
              payment(self) (Stripe).
            </p>
          </Card>
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">X-Frame-Options</p>
            <p className="text-muted-foreground text-xs">
              <code>SAMEORIGIN</code> + CSP <code>frame-ancestors 'self'</code>.
            </p>
          </Card>
          <Card className="space-y-1 p-4 text-sm">
            <p className="font-medium">Referrer-Policy</p>
            <p className="text-muted-foreground text-xs">
              <code>strict-origin-when-cross-origin</code>.
            </p>
          </Card>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        <Link href="/admin/ajustes/seguridad" className="hover:underline">
          ← Volver al centro de seguridad
        </Link>
      </p>
    </div>
  );
}
