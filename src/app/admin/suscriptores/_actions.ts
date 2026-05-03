"use server";

import { requireUser } from "@/auth/server";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import {
  bulkImport,
  bulkUnsubscribe,
  deleteSubscribers,
  parseSubscribersCsv,
  subscribe,
  tagSubscribers,
} from "@/newsletter/subscribers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  source: z.string().max(80).optional(),
  preConfirmed: z.boolean().optional(),
});

export async function createSubscriberAction(input: z.input<typeof CreateSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const result = await subscribe({
    workspaceId: ctx.workspace.id,
    email: parsed.data.email,
    name: parsed.data.name ?? null,
    tags: parsed.data.tags ?? null,
    source: parsed.data.source ?? "admin",
    preConfirmed: parsed.data.preConfirmed ?? true,
  });
  if (!result.ok) return { ok: false as const, error: result.error };

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "subscriber.created_admin",
    targetType: "subscriber",
    targetId: result.subscriber.id,
    meta: { email: result.subscriber.email },
  });

  revalidatePath("/admin/suscriptores");
  return { ok: true as const, subscriber: result.subscriber };
}

const DeleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export async function deleteSubscribersAction(input: z.input<typeof DeleteSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const deleted = await deleteSubscribers(ctx.workspace.id, parsed.data.ids);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "subscribers.deleted",
    targetType: "subscriber",
    meta: { count: deleted },
  });
  revalidatePath("/admin/suscriptores");
  return { ok: true as const, deleted };
}

const UnsubBulkSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export async function unsubscribeBulkAction(input: z.input<typeof UnsubBulkSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = UnsubBulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const updated = await bulkUnsubscribe(ctx.workspace.id, parsed.data.ids);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "subscribers.bulk_unsubscribe",
    targetType: "subscriber",
    meta: { count: updated },
  });
  revalidatePath("/admin/suscriptores");
  return { ok: true as const, updated };
}

const TagSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  add: z.array(z.string().min(1).max(64)).max(20).default([]),
  remove: z.array(z.string().min(1).max(64)).max(20).default([]),
});

export async function tagSubscribersAction(input: z.input<typeof TagSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  const parsed = TagSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const updated = await tagSubscribers(
    ctx.workspace.id,
    parsed.data.ids,
    parsed.data.add,
    parsed.data.remove,
  );
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "subscribers.tagged",
    targetType: "subscriber",
    meta: { count: updated, add: parsed.data.add, remove: parsed.data.remove },
  });
  revalidatePath("/admin/suscriptores");
  return { ok: true as const, updated };
}

const ImportSchema = z.object({
  csv: z.string().min(5).max(5_000_000),
  source: z.string().max(80).optional(),
  preConfirmed: z.boolean().optional(),
});

export async function importSubscribersAction(input: z.input<typeof ImportSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  const parsed = ImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  const rows = parseSubscribersCsv(parsed.data.csv);
  if (rows.length === 0) return { ok: false as const, error: "empty_csv" };
  if (rows.length > 50_000) return { ok: false as const, error: "too_many_rows" };

  const result = await bulkImport(ctx.workspace.id, rows, {
    source: parsed.data.source ?? "csv",
    preConfirmed: parsed.data.preConfirmed ?? true,
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "subscribers.csv_import",
    targetType: "subscriber",
    meta: result,
  });
  revalidatePath("/admin/suscriptores");
  return { ok: true as const, result };
}
