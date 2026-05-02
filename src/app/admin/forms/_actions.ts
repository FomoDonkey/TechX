"use server";

import { requireUser } from "@/auth/server";
import type { Form } from "@/db/schema";
import {
  archiveForm,
  createForm,
  deleteForm,
  deleteSubmissions,
  publishForm,
  setSubmissionStatus,
  updateForm,
} from "@/forms/lib";
import { hashIp, processSubmission } from "@/forms/submit";
import { getFormTemplate } from "@/forms/templates";
import type { FormSchema, FormSettings } from "@/forms/types";
import { logActivity } from "@/lib/activity";
import { isValidSlug, slugify } from "@/lib/slug";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SchemaJsonSchema = z.object({
  fields: z.array(z.record(z.unknown())),
  steps: z.array(z.record(z.unknown())).default([]),
  successMessage: z.string().optional(),
  redirectUrl: z.string().url().optional().or(z.literal("")),
  submitLabel: z.string().optional(),
});

const SettingsJsonSchema = z.object({
  doubleOptIn: z.boolean().optional(),
  honeypotFieldName: z.string().optional(),
  minSubmitTimeMs: z.number().int().min(0).max(60000).optional(),
  captcha: z
    .object({ provider: z.enum(["hcaptcha", "turnstile"]), siteKey: z.string().min(1) })
    .optional(),
  storeIp: z.boolean().optional(),
  allowedOrigins: z.array(z.string()).optional(),
  perIpHourly: z.number().int().min(1).max(10_000).optional(),
  perIpDaily: z.number().int().min(1).max(100_000).optional(),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(48).optional(),
  templateSlug: z.string().optional(),
});

export async function createFormAction(input: z.input<typeof CreateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  const slugCandidate = parsed.data.slug?.trim() || slugify(parsed.data.name);
  if (!isValidSlug(slugCandidate)) {
    return { ok: false as const, error: "Slug inválido" };
  }
  const tpl = parsed.data.templateSlug ? getFormTemplate(parsed.data.templateSlug) : undefined;
  const schema: FormSchema = tpl?.schema ?? { fields: [], steps: [] };
  try {
    const created = await createForm({
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      slug: slugCandidate,
      schema,
      createdById: user.id,
    });
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "form.created",
      targetType: "form",
      targetId: created.id,
    });
    revalidatePath("/admin/forms");
    return { ok: true as const, id: created.id, slug: created.slug };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (/duplicate|unique/i.test(msg)) {
      return { ok: false as const, error: "Ya existe un formulario con ese slug" };
    }
    return { ok: false as const, error: msg };
  }
}

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(48).optional(),
  description: z.string().max(500).nullable().optional(),
  schema: SchemaJsonSchema.optional(),
  settings: SettingsJsonSchema.optional(),
  successMessage: z.string().nullable().optional(),
  redirectUrl: z.string().url().nullable().optional(),
  notificationEmails: z.array(z.string().email()).optional(),
});

export async function updateFormAction(input: z.input<typeof UpdateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (parsed.data.slug && !isValidSlug(parsed.data.slug)) {
    return { ok: false as const, error: "Slug inválido" };
  }
  const patch: Parameters<typeof updateForm>[2] = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.schema !== undefined) patch.schema = parsed.data.schema as unknown as FormSchema;
  if (parsed.data.settings !== undefined)
    patch.settings = parsed.data.settings as unknown as FormSettings;
  if (parsed.data.successMessage !== undefined) patch.successMessage = parsed.data.successMessage;
  if (parsed.data.redirectUrl !== undefined) patch.redirectUrl = parsed.data.redirectUrl;
  if (parsed.data.notificationEmails !== undefined)
    patch.notificationEmails = parsed.data.notificationEmails;
  try {
    const updated = await updateForm(ctx.workspace.id, parsed.data.id, patch);
    if (!updated) return { ok: false as const, error: "Form no encontrado" };
    await logActivity({
      workspaceId: ctx.workspace.id,
      actorId: user.id,
      action: "form.updated",
      targetType: "form",
      targetId: parsed.data.id,
    });
    revalidatePath("/admin/forms");
    revalidatePath(`/admin/forms/${parsed.data.id}`);
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    if (/duplicate|unique/i.test(msg)) {
      return { ok: false as const, error: "Ya existe un formulario con ese slug" };
    }
    return { ok: false as const, error: msg };
  }
}

export async function publishFormAction(
  id: string,
): Promise<{ ok: true; form: Form } | { ok: false; error: string }> {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID inválido" };
  const form = await publishForm(ctx.workspace.id, id, user.id);
  if (!form) return { ok: false, error: "Form no encontrado" };
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "form.published",
    targetType: "form",
    targetId: id,
  });
  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${id}`);
  return { ok: true, form };
}

export async function archiveFormAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!z.string().uuid().safeParse(id).success) return { ok: false as const, error: "ID inválido" };
  await archiveForm(ctx.workspace.id, id);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "form.archived",
    targetType: "form",
    targetId: id,
  });
  revalidatePath("/admin/forms");
  return { ok: true as const };
}

export async function deleteFormAction(id: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  if (!z.string().uuid().safeParse(id).success) return { ok: false as const, error: "ID inválido" };
  await deleteForm(ctx.workspace.id, id);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "form.deleted",
    targetType: "form",
    targetId: id,
  });
  revalidatePath("/admin/forms");
  return { ok: true as const };
}

const SubmissionStatusSchema = z.enum(["received", "spam", "processed", "archived"]);

export async function setSubmissionStatusAction(input: {
  id: string;
  status: z.infer<typeof SubmissionStatusSchema>;
}) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!z.string().uuid().safeParse(input.id).success)
    return { ok: false as const, error: "ID inválido" };
  const status = SubmissionStatusSchema.safeParse(input.status);
  if (!status.success) return { ok: false as const, error: "Estado inválido" };
  await setSubmissionStatus(ctx.workspace.id, input.id, status.data);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: `submission.${status.data}`,
    targetType: "submission",
    targetId: input.id,
  });
  revalidatePath("/admin/forms");
  return { ok: true as const };
}

export async function deleteSubmissionsAction(ids: string[]) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const valid = ids.filter((i) => z.string().uuid().safeParse(i).success);
  if (valid.length === 0) return { ok: false as const, error: "Sin IDs válidos" };
  const n = await deleteSubmissions(ctx.workspace.id, valid);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "submission.deleted_bulk",
    targetType: "submission",
    targetId: null,
    meta: { count: n },
  });
  revalidatePath("/admin/forms");
  return { ok: true as const, deleted: n };
}

/** Test interno desde el preview del builder — no persiste si dryRun. */
export async function testSubmitAction(input: {
  formId: string;
  data: Record<string, unknown>;
}) {
  const ctx = await requireWorkspace("editor");
  const { getFormById } = await import("@/forms/lib");
  const form = await getFormById(ctx.workspace.id, input.formId);
  if (!form) return { ok: false as const, error: "Form no encontrado" };
  const out = await processSubmission({
    form,
    raw: input.data,
    ip: "127.0.0.1",
    ipHash: hashIp("127.0.0.1"),
    userAgent: "CSM-AdminPreview/1.0",
    formLoadedAt: Date.now() - 5000,
  });
  return { ok: true as const, result: out };
}
