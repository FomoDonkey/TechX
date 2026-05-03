"use server";

import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { redirects } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import {
  type CsvRow,
  bulkDeleteRedirects,
  bulkInsertRedirects,
  bulkSetEnabled,
  createRedirect,
  deleteRedirect,
  parseCsv,
  redirectsToCsv,
  updateRedirect,
} from "@/redirects/lib";
import { invalidateRedirectsCache } from "@/redirects/runtime";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const StatusCode = z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]);
const MatchType = z.enum(["exact", "prefix", "regex"]);

const CreateInput = z.object({
  source: z.string().min(1).max(2048),
  destination: z.string().min(1).max(2048),
  statusCode: StatusCode.optional(),
  matchType: MatchType.optional(),
  preserveQuery: z.boolean().optional(),
  enabled: z.boolean().optional(),
  description: z.string().max(280).optional(),
});

export async function createRedirectAction(input: z.infer<typeof CreateInput>) {
  const ctx = await requireWorkspace("editor");
  const user = await getCurrentUser();
  const data = CreateInput.parse(input);
  await createRedirect({
    workspaceId: ctx.workspace.id,
    source: data.source,
    destination: data.destination,
    statusCode: data.statusCode,
    matchType: data.matchType,
    preserveQuery: data.preserveQuery,
    enabled: data.enabled,
    description: data.description,
    createdById: user?.id ?? null,
  });
  invalidateRedirectsCache(ctx.workspace.id);
  revalidatePath("/admin/redirects");
  return { ok: true };
}

const UpdateInput = CreateInput.extend({ id: z.string().uuid() }).partial({
  source: true,
  destination: true,
});

export async function updateRedirectAction(input: z.infer<typeof UpdateInput>) {
  const ctx = await requireWorkspace("editor");
  const data = UpdateInput.parse(input);
  await updateRedirect({
    workspaceId: ctx.workspace.id,
    id: data.id,
    source: data.source,
    destination: data.destination,
    statusCode: data.statusCode,
    matchType: data.matchType,
    preserveQuery: data.preserveQuery,
    enabled: data.enabled,
    description: data.description,
  });
  invalidateRedirectsCache(ctx.workspace.id);
  revalidatePath("/admin/redirects");
  return { ok: true };
}

export async function deleteRedirectAction(id: string) {
  const ctx = await requireWorkspace("admin");
  z.string().uuid().parse(id);
  await deleteRedirect(ctx.workspace.id, id);
  invalidateRedirectsCache(ctx.workspace.id);
  revalidatePath("/admin/redirects");
  return { ok: true };
}

const BulkInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["delete", "enable", "disable"]),
});

export async function bulkRedirectAction(input: z.infer<typeof BulkInput>) {
  const ctx = await requireWorkspace("admin");
  const data = BulkInput.parse(input);
  let count = 0;
  if (data.action === "delete") {
    count = await bulkDeleteRedirects(ctx.workspace.id, data.ids);
  } else {
    count = await bulkSetEnabled(ctx.workspace.id, data.ids, data.action === "enable");
  }
  invalidateRedirectsCache(ctx.workspace.id);
  revalidatePath("/admin/redirects");
  return { ok: true, count };
}

const PreviewInput = z.object({ csv: z.string().min(1).max(1_000_000) });

export async function previewCsvImportAction(input: z.infer<typeof PreviewInput>) {
  await requireWorkspace("editor");
  const data = PreviewInput.parse(input);
  const result = parseCsv(data.csv);
  return {
    rows: result.rows.slice(0, 50),
    errors: result.errors,
    total: result.total,
    valid: result.rows.length,
  };
}

const ImportInput = z.object({
  csv: z.string().min(1).max(1_000_000),
  skipExisting: z.boolean().optional(),
});

export async function importCsvAction(input: z.infer<typeof ImportInput>) {
  const ctx = await requireWorkspace("admin");
  const user = await getCurrentUser();
  const data = ImportInput.parse(input);
  const parsed = parseCsv(data.csv);
  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    return { ok: false as const, errors: parsed.errors };
  }
  const result = await bulkInsertRedirects(ctx.workspace.id, parsed.rows as CsvRow[], {
    skipExisting: data.skipExisting ?? true,
    createdById: user?.id ?? null,
  });
  invalidateRedirectsCache(ctx.workspace.id);
  revalidatePath("/admin/redirects");
  return { ok: true as const, ...result, parsed: { errors: parsed.errors, total: parsed.total } };
}

export async function exportCsvAction(): Promise<{ csv: string }> {
  const ctx = await requireWorkspace("editor");
  if (!db) return { csv: "" };
  const rows = await db.select().from(redirects).where(eq(redirects.workspaceId, ctx.workspace.id));
  return { csv: redirectsToCsv(rows) };
}

/** Verifica un path contra las reglas en vivo (admin debug). */
export async function testRedirectAction(input: { path: string }) {
  const ctx = await requireWorkspace("editor");
  const path = z.string().min(1).max(2048).parse(input.path);
  const { listActiveRedirectsForWorkspace } = await import("@/redirects/lib");
  const { matchRedirect } = await import("@/redirects/matcher");
  const rules = await listActiveRedirectsForWorkspace(ctx.workspace.id);
  const match = matchRedirect(path, rules);
  if (!match) return { match: false as const };
  return {
    match: true as const,
    destination: match.destination,
    statusCode: match.statusCode,
    via: match.rule.id,
  };
}
