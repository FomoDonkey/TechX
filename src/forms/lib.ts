/**
 * CRUD + lecturas para forms y submissions. Todas las funciones reciben
 * workspaceId explícitamente y filtran por él para evitar leak cross-tenant.
 */

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { deleteReturningCount, iLike as ilike, insertReturning } from "@/db/dialect";
import {
  type Form,
  type FormVersion,
  type Submission,
  formVersions,
  forms,
  submissions,
} from "@/db/schema";
import { and, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { FormSchema, FormSettings } from "./types";

export type FormListItem = Form & {
  computedSubmissionsCount?: number;
};

export async function listForms(
  workspaceId: string,
  opts?: { search?: string; status?: string },
): Promise<Form[]> {
  if (!db) return [];
  const conditions = [eq(forms.workspaceId, workspaceId)];
  if (opts?.status) conditions.push(eq(forms.status, opts.status as Form["status"]));
  if (opts?.search) conditions.push(ilike(forms.name, `%${opts.search}%`));
  return db
    .select()
    .from(forms)
    .where(and(...conditions))
    .orderBy(desc(forms.updatedAt));
}

export async function getFormById(workspaceId: string, id: string): Promise<Form | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getFormBySlug(workspaceId: string, slug: string): Promise<Form | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.workspaceId, workspaceId), eq(forms.slug, slug)))
    .limit(1);
  return row ?? null;
}

/**
 * Versión "pública" — busca por (workspaceId, slug) en estado published.
 * IMPORTANTE: requiere `workspaceId` para evitar cross-tenant lookup. Antes
 * un slug "contact" en wsA podía resolver al form de wsB si llegaban primero.
 * El caller debe resolver el workspace por host antes de invocar.
 */
export async function getPublishedFormBySlug(
  workspaceId: string,
  slug: string,
): Promise<Form | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(forms)
    .where(
      and(eq(forms.workspaceId, workspaceId), eq(forms.slug, slug), eq(forms.status, "published")),
    )
    .limit(1);
  return row ?? null;
}

export async function createForm(input: {
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  schema: FormSchema;
  settings?: FormSettings;
  createdById?: string | null;
}): Promise<Form> {
  if (!db) throw new Error("DB no disponible");
  const honeypotName = input.settings?.honeypotFieldName ?? `csm_${randomBytes(4).toString("hex")}`;
  const settings: FormSettings = {
    ...(input.settings ?? {}),
    honeypotFieldName: honeypotName,
  };
  const newId = crypto.randomUUID();
  const row = (await insertReturning(forms, {
    id: newId,
    workspaceId: input.workspaceId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    schema: input.schema as unknown as object,
    settings: settings as unknown as object,
    status: "draft",
    version: 1,
    createdById: input.createdById ?? null,
  })) as Form;
  if (!row) throw new Error("No se pudo crear el form");
  return row;
}

export async function updateForm(
  workspaceId: string,
  id: string,
  patch: Partial<{
    name: string;
    slug: string;
    description: string | null;
    schema: FormSchema;
    settings: FormSettings;
    status: Form["status"];
    successMessage: string | null;
    redirectUrl: string | null;
    notificationEmails: string[];
  }>,
): Promise<Form | null> {
  if (!db) return null;
  const setObj: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) setObj.name = patch.name;
  if (patch.slug !== undefined) setObj.slug = patch.slug;
  if (patch.description !== undefined) setObj.description = patch.description;
  if (patch.schema !== undefined) setObj.schema = patch.schema as unknown as object;
  if (patch.settings !== undefined) setObj.settings = patch.settings as unknown as object;
  if (patch.status !== undefined) setObj.status = patch.status;
  if (patch.successMessage !== undefined) setObj.successMessage = patch.successMessage;
  if (patch.redirectUrl !== undefined) setObj.redirectUrl = patch.redirectUrl;
  if (patch.notificationEmails !== undefined) setObj.notificationEmails = patch.notificationEmails;
  await db
    .update(forms)
    .set(setObj)
    .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, id)));
  const [row] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, id)))
    .limit(1);
  return row ?? null;
}

/** Publica una versión: copia el schema actual a form_versions y bump version. */
export async function publishForm(
  workspaceId: string,
  id: string,
  publishedById: string | null,
): Promise<Form | null> {
  if (!db) return null;
  const current = await getFormById(workspaceId, id);
  if (!current) return null;
  return db.transaction(async (tx) => {
    const newVersion = current.version + (current.status === "published" ? 1 : 0);
    await tx.insert(formVersions).values({
      formId: id,
      version: newVersion,
      schema: (current.schema ?? { fields: [], steps: [] }) as unknown as object,
      publishedById: publishedById ?? null,
    });
    await tx
      .update(forms)
      .set({ status: "published", version: newVersion, updatedAt: new Date() })
      .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, id)));
    const [row] = await tx
      .select()
      .from(forms)
      .where(and(eq(forms.workspaceId, workspaceId), eq(forms.id, id)))
      .limit(1);
    return row ?? null;
  });
}

export async function deleteForm(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  const deleted = await deleteReturningCount(
    forms,
    and(eq(forms.workspaceId, workspaceId), eq(forms.id, id))!,
  );
  return deleted > 0;
}

export async function archiveForm(workspaceId: string, id: string): Promise<Form | null> {
  return updateForm(workspaceId, id, { status: "archived" });
}

// ============================================================
// VERSIONS
// ============================================================

export async function listFormVersions(
  workspaceId: string,
  formId: string,
): Promise<FormVersion[]> {
  if (!db) return [];
  // Validamos pertenencia primero.
  const owner = await getFormById(workspaceId, formId);
  if (!owner) return [];
  return db
    .select()
    .from(formVersions)
    .where(eq(formVersions.formId, formId))
    .orderBy(desc(formVersions.version));
}

export async function getFormVersion(
  workspaceId: string,
  formId: string,
  version: number,
): Promise<FormVersion | null> {
  if (!db) return null;
  const owner = await getFormById(workspaceId, formId);
  if (!owner) return null;
  const [row] = await db
    .select()
    .from(formVersions)
    .where(and(eq(formVersions.formId, formId), eq(formVersions.version, version)))
    .limit(1);
  return row ?? null;
}

// ============================================================
// SUBMISSIONS
// ============================================================

export type SubmissionListInput = {
  workspaceId: string;
  formId?: string;
  status?: Submission["status"];
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: { createdAt: string; id: string } | null;
};

export type SubmissionListResult = {
  rows: Submission[];
  nextCursor: { createdAt: string; id: string } | null;
};

export async function listSubmissions(input: SubmissionListInput): Promise<SubmissionListResult> {
  if (!db) return { rows: [], nextCursor: null };
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 200);
  const conditions = [eq(submissions.workspaceId, input.workspaceId)];
  if (input.formId) conditions.push(eq(submissions.formId, input.formId));
  if (input.status) conditions.push(eq(submissions.status, input.status));
  if (input.from) conditions.push(gte(submissions.createdAt, input.from));
  if (input.to) conditions.push(lte(submissions.createdAt, input.to));
  if (input.search) {
    // Búsqueda en jsonb data via cast a text (suficiente para inboxes pequeños).
    conditions.push(sql`${submissions.data}::text ILIKE ${`%${input.search}%`}`);
  }
  if (input.cursor) {
    const cursorDate = new Date(input.cursor.createdAt);
    conditions.push(
      or(
        sql`${submissions.createdAt} < ${cursorDate}`,
        and(eq(submissions.createdAt, cursorDate), sql`${submissions.id} < ${input.cursor.id}`),
      )!,
    );
  }
  const rows = await db
    .select()
    .from(submissions)
    .where(and(...conditions))
    .orderBy(desc(submissions.createdAt), desc(submissions.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const last = sliced[sliced.length - 1];
  const nextCursor =
    hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null;
  return { rows: sliced, nextCursor };
}

export async function getSubmission(workspaceId: string, id: string): Promise<Submission | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.workspaceId, workspaceId), eq(submissions.id, id)))
    .limit(1);
  return row ?? null;
}

export async function setSubmissionStatus(
  workspaceId: string,
  id: string,
  status: Submission["status"],
): Promise<Submission | null> {
  if (!db) return null;
  await db
    .update(submissions)
    .set({
      status,
      processedAt: status === "processed" ? new Date() : undefined,
    })
    .where(and(eq(submissions.workspaceId, workspaceId), eq(submissions.id, id)));
  const [row] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.workspaceId, workspaceId), eq(submissions.id, id)))
    .limit(1);
  return row ?? null;
}

export async function deleteSubmissions(workspaceId: string, ids: string[]): Promise<number> {
  if (!db || ids.length === 0) return 0;
  return await deleteReturningCount(
    submissions,
    and(eq(submissions.workspaceId, workspaceId), inArray(submissions.id, ids))!,
  );
}

export async function countSubmissionsByForm(workspaceId: string): Promise<Record<string, number>> {
  if (!db) return {};
  const rows = await db
    .select({ formId: submissions.formId, n: count() })
    .from(submissions)
    .where(eq(submissions.workspaceId, workspaceId))
    .groupBy(submissions.formId);
  return Object.fromEntries(rows.map((r) => [r.formId, Number(r.n)]));
}

// ============================================================
// CONTENT HASH (idempotencia + dedupe)
// ============================================================

/**
 * Hash canónico del contenido de la submission. Excluye keys técnicas (csm_*)
 * y honeypot. Se usa como índice unique (formId, contentHash) para evitar
 * dobles envíos del mismo contenido en el mismo form.
 */
export function computeContentHash(formId: string, data: Record<string, unknown>): string {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith("csm_")) continue;
    filtered[k] = v;
  }
  const sorted = Object.keys(filtered)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = filtered[k];
      return acc;
    }, {});
  const canonical = JSON.stringify(sorted);
  return createHash("sha256").update(`${formId}.${canonical}`).digest("hex");
}

// ============================================================
// CSV EXPORT
// ============================================================

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function submissionsToCsv(schema: FormSchema | null, rows: Submission[]): string {
  const inputs = (schema?.fields ?? []).filter(
    (f): f is typeof f & { key: string } => "key" in f && Boolean((f as { key?: string }).key),
  );
  const cols = ["id", "createdAt", "status", "spamScore", ...inputs.map((f) => f.key)];
  const header = cols.map(csvEscape).join(",");
  const body = rows
    .map((r) => {
      const data = (r.data ?? {}) as Record<string, unknown>;
      const values = [
        r.id,
        r.createdAt.toISOString(),
        r.status,
        String(r.spamScore),
        ...inputs.map((f) => {
          const v = data[f.key];
          if (v === undefined || v === null) return "";
          if (Array.isArray(v)) return v.join("; ");
          return String(v);
        }),
      ];
      return values.map(csvEscape).join(",");
    })
    .join("\n");
  return `${header}\n${body}`;
}
