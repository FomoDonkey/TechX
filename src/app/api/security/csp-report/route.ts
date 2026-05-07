import { db } from "@/db/client";
import { upsert } from "@/db/dialect";
import { cspReports } from "@/db/schema";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Endpoint receptor de violaciones CSP enviadas por navegadores cuando una
 * directiva bloquea (o reportaría bloquear, en modo `Report-Only`).
 *
 * **Diseño v2 (F10a parte 2 bloque 3)**:
 * Persiste en tabla `csp_reports` agregada por `dedupKey` (SHA-256 de los
 * campos identificativos). UPSERT incrementa `occurrences` y refresca
 * `lastSeenAt` para deduplicar reportes idénticos producidos a alta cadencia.
 *
 * Si DB no está disponible (CI, build, dev sin Postgres), cae a `console.warn`
 * — no rompe el navegador del visitante.
 *
 * Soporta dos formatos:
 *  - Legacy: `{ "csp-report": { ... } }` (Chrome ≤ 90, Firefox ≤ 110).
 *  - Reporting API: `[{ type: "csp-violation", body: { ... } }]` o `{ type, body }`.
 *
 * El endpoint NO hace auth — los browsers no envían cookies en `report-uri`.
 * Anti-abuso defensivo: cap a 50 KB body, ignora payloads más grandes.
 */
export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text || text.length > 50_000) return new NextResponse(null, { status: 204 });
    const body = JSON.parse(text);
    const reports = normalizeReports(body);
    if (!db || reports.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        for (const r of reports) console.warn("[CSP report]", r);
      }
      return new NextResponse(null, { status: 204 });
    }
    for (const r of reports) {
      await upsertReport(r, req.headers.get("user-agent"));
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[CSP] parse failed", err);
  }
  return new NextResponse(null, { status: 204 });
}

type ParsedReport = {
  blockedUri: string | null;
  violatedDirective: string;
  effectiveDirective: string | null;
  documentUri: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  sample: string | null;
  disposition: string | null;
};

function normalizeReports(body: unknown): ParsedReport[] {
  if (Array.isArray(body)) {
    return body
      .filter((b): b is { type: string; body: Record<string, unknown> } => {
        return (
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          (b as Record<string, unknown>).type === "csp-violation"
        );
      })
      .map((b) => parseReportingApiBody(b.body))
      .filter((r): r is ParsedReport => r !== null);
  }
  if (typeof body === "object" && body !== null) {
    const o = body as Record<string, unknown>;
    if ("csp-report" in o && typeof o["csp-report"] === "object") {
      const r = parseLegacy(o["csp-report"] as Record<string, unknown>);
      return r ? [r] : [];
    }
    if (
      "type" in o &&
      o.type === "csp-violation" &&
      "body" in o &&
      typeof o.body === "object" &&
      o.body !== null
    ) {
      const r = parseReportingApiBody(o.body as Record<string, unknown>);
      return r ? [r] : [];
    }
  }
  return [];
}

function parseLegacy(o: Record<string, unknown>): ParsedReport | null {
  const directive = str(o["violated-directive"]) ?? str(o["effective-directive"]);
  if (!directive) return null;
  return {
    blockedUri: str(o["blocked-uri"]),
    violatedDirective: directive.split(/\s+/)[0] ?? directive,
    effectiveDirective: str(o["effective-directive"]),
    documentUri: str(o["document-uri"]),
    sourceFile: str(o["source-file"]),
    lineNumber: num(o["line-number"]),
    columnNumber: num(o["column-number"]),
    sample: clipSample(str(o["script-sample"])),
    disposition: str(o.disposition),
  };
}

function parseReportingApiBody(o: Record<string, unknown>): ParsedReport | null {
  const directive = str(o.effectiveDirective) ?? str(o.violatedDirective);
  if (!directive) return null;
  return {
    blockedUri: str(o.blockedURL) ?? str(o.blockedUri),
    violatedDirective: directive.split(/\s+/)[0] ?? directive,
    effectiveDirective: str(o.effectiveDirective),
    documentUri: str(o.documentURL) ?? str(o.documentUri),
    sourceFile: str(o.sourceFile),
    lineNumber: num(o.lineNumber),
    columnNumber: num(o.columnNumber),
    sample: clipSample(str(o.sample)),
    disposition: str(o.disposition),
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, 2048) : null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
}
function clipSample(v: string | null): string | null {
  return v ? v.slice(0, 500) : null;
}

async function upsertReport(r: ParsedReport, ua: string | null): Promise<void> {
  if (!db) return;
  const key = await dedupKey(r);
  const uaHash = ua ? await sha256(`csp:ua:${ua}`) : null;
  try {
    await upsert(cspReports, {
      values: {
        dedupKey: key,
        blockedUri: r.blockedUri,
        violatedDirective: r.violatedDirective,
        effectiveDirective: r.effectiveDirective,
        documentUri: r.documentUri,
        sourceFile: r.sourceFile,
        lineNumber: r.lineNumber,
        columnNumber: r.columnNumber,
        sample: r.sample,
        userAgentHash: uaHash,
        disposition: r.disposition,
      },
      target: cspReports.dedupKey,
      // SQL fragments funcionan en ambos: `col + 1` y `NOW()` son válidos en
      // Postgres y MySQL. `NULL` también es ANSI estándar.
      set: {
        occurrences: sql`${cspReports.occurrences} + 1`,
        lastSeenAt: sql`NOW()`,
        resolvedAt: sql`NULL`,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[CSP] upsert failed", err);
  }
}

async function dedupKey(r: ParsedReport): Promise<string> {
  return sha256(
    [r.violatedDirective, r.blockedUri ?? "", r.sourceFile ?? "", r.lineNumber ?? 0].join("|"),
  );
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
