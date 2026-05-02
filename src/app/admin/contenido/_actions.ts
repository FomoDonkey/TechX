"use server";

import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { type Entry, entries, revisions } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import {
  POSTS_SLUG,
  createEntry,
  ensureUniqueEntrySlug,
  getEntryById,
  getOrCreateBuiltinCollection,
  getRevision,
} from "@/lib/entries";
import { slugify } from "@/lib/slug";
import { requireWorkspace } from "@/lib/workspace";
import { enqueueIndex } from "@/search/jobs";
import { emitAsync } from "@/webhooks/dispatcher";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const REVISION_INTERVAL_MS = 5 * 60 * 1000;
const REVISION_DELTA_CHARS = 200;

function bodyToText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) for (const c of n.content) visit(c);
  };
  visit(body);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

async function createPostInternal(title: string) {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  const collection = await getOrCreateBuiltinCollection(ctx.workspace.id, POSTS_SLUG);
  const created = await createEntry({
    workspaceId: ctx.workspace.id,
    collectionId: collection.id,
    authorId: user.id,
    title,
  });
  revalidatePath("/admin/contenido");
  revalidatePath("/admin");
  return created;
}

/** Crea entrada en una colección custom (no builtin). Usado por el listado por colección. */
export async function createEntryInCollectionAction(input: {
  collectionId: string;
  title?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("author");
    const created = await createEntry({
      workspaceId: ctx.workspace.id,
      collectionId: input.collectionId,
      authorId: user.id,
      title: input.title ?? "",
    });
    revalidatePath("/admin/contenido");
    return { ok: true, id: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo crear la entrada" };
  }
}

/**
 * Para singletons: garantiza que existe una entrada y devuelve su id.
 * Si no existe, la crea con title = nombre de la colección.
 */
export async function ensureSingletonEntryAction(input: {
  collectionId: string;
  collectionName: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const ctx = await requireWorkspace("author");
    if (!db) return { ok: false, error: "DB no configurada" };
    const existing = await db
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(
          eq(entries.workspaceId, ctx.workspace.id),
          eq(entries.collectionId, input.collectionId),
        ),
      )
      .limit(1);
    if (existing[0]) return { ok: true, id: existing[0].id };
    const created = await createEntry({
      workspaceId: ctx.workspace.id,
      collectionId: input.collectionId,
      authorId: user.id,
      title: input.collectionName,
    });
    return { ok: true, id: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo crear" };
  }
}

/**
 * Para `<form action={createNewPostFormAction}>`: crea entrada y redirige al editor.
 * Next maneja el `redirect()` automáticamente cuando se invoca desde un form.
 */
export async function createNewPostFormAction(formData: FormData): Promise<void> {
  const title = (formData.get("title") as string | null) ?? "";
  const created = await createPostInternal(title);
  redirect(`/admin/contenido/${created.id}`);
}

/**
 * Variante imperativa para invocar desde handlers cliente (palette, atajos).
 * Devuelve el id; el cliente hace `router.push` manualmente.
 */
export async function createNewPostAction(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  try {
    const created = await createPostInternal("");
    return { ok: true, id: created.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo crear la entrada",
    };
  }
}

const SaveSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(96).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  body: z.unknown().optional(),
  fields: z.record(z.unknown()).nullable().optional(),
  seo: z
    .object({
      title: z.string().max(120).optional(),
      description: z.string().max(280).optional(),
      ogImage: z.string().url().optional(),
    })
    .nullable()
    .optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export type SaveEntryInput = z.input<typeof SaveSchema>;
export type SaveEntryResult =
  | { ok: true; updatedAt: string; slug: string; revisionId: string | null }
  | { ok: false; error: string };

export async function saveEntryAction(input: SaveEntryInput): Promise<SaveEntryResult> {
  const user = await requireUser();
  const ctx = await requireWorkspace("author");
  if (!db) return { ok: false, error: "DB no configurada" };

  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const current = await getEntryById(ctx.workspace.id, data.id);
  if (!current) return { ok: false, error: "No encontrada" };

  let nextSlug = current.slug;
  if (data.slug && data.slug !== current.slug) {
    const baseSlug = slugify(data.slug) || current.slug;
    nextSlug = await ensureUniqueEntrySlug(
      ctx.workspace.id,
      current.collectionId,
      current.locale,
      baseSlug,
      current.id,
    );
  }

  const nextBody = data.body ?? current.body;
  const nextBodyText = bodyToText(nextBody);

  const previousText = current.bodyText ?? "";
  const lastRevisionAt = (
    await db
      .select({ createdAt: revisions.createdAt })
      .from(revisions)
      .where(eq(revisions.entryId, current.id))
      .orderBy(desc(revisions.createdAt))
      .limit(1)
  )[0]?.createdAt;

  const sinceLastMs = lastRevisionAt
    ? Date.now() - new Date(lastRevisionAt).getTime()
    : Number.POSITIVE_INFINITY;
  const charsDelta = Math.abs(nextBodyText.length - previousText.length);
  const shouldSnapshot =
    !lastRevisionAt || sinceLastMs >= REVISION_INTERVAL_MS || charsDelta >= REVISION_DELTA_CHARS;

  let revisionId: string | null = null;
  await db.transaction(async (tx) => {
    if (shouldSnapshot && current.body) {
      const [rev] = await tx
        .insert(revisions)
        .values({
          entryId: current.id,
          body: current.body as never,
          summary: previousText.slice(0, 80),
          authorId: current.updatedById ?? user.id,
        })
        .returning({ id: revisions.id });
      if (rev) revisionId = rev.id;
    }

    await tx
      .update(entries)
      .set({
        title: data.title ?? current.title,
        slug: nextSlug,
        excerpt: data.excerpt ?? current.excerpt,
        body: nextBody as never,
        bodyText: nextBodyText,
        fields:
          data.fields === undefined
            ? (current.fields as never)
            : data.fields === null
              ? null
              : (data.fields as never),
        seo: (data.seo === null ? null : (data.seo ?? current.seo)) as never,
        scheduledAt:
          data.scheduledAt === undefined
            ? current.scheduledAt
            : data.scheduledAt === null
              ? null
              : new Date(data.scheduledAt),
        updatedById: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(entries.id, current.id), eq(entries.workspaceId, ctx.workspace.id)));
  });

  revalidatePath(`/admin/contenido/${current.id}`);
  revalidatePath("/admin/contenido");
  revalidateTag(`post:${ctx.workspace.slug}:${nextSlug}`);

  // Encolar embedding solo si el contenido cambió suficientemente.
  // Best-effort: si falla, no bloquea el guardado.
  if (charsDelta >= 50 || (data.title && data.title !== current.title)) {
    void enqueueIndex({ workspaceId: ctx.workspace.id, entryId: current.id }).catch(() => {});
  }

  // Webhook entry.updated (fire-and-forget)
  emitAsync({
    workspaceId: ctx.workspace.id,
    event: "entry.updated",
    payload: {
      id: current.id,
      title: data.title ?? current.title,
      slug: nextSlug,
      status: current.status,
      via: "admin",
    },
  });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    slug: nextSlug,
    revisionId,
  };
}

const StatusActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function publishEntriesAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const parsed = StatusActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  // Filtramos por status != 'published' para que el RETURNING sólo devuelva
  // las entradas que realmente transicionaron — evita webhooks duplicados al
  // re-publicar un set que ya estaba publicado.
  const transitioned = await db
    .update(entries)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedById: user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(entries.workspaceId, ctx.workspace.id),
        inArray(entries.id, parsed.data.ids),
        ne(entries.status, "published"),
      ),
    )
    .returning({ id: entries.id });

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "entries.published",
    targetType: "entry",
    meta: { count: transitioned.length, requested: parsed.data.ids.length },
  });

  // Re-encola embeddings (todos los publicados, transicionaron o no)
  for (const id of parsed.data.ids) {
    void enqueueIndex({ workspaceId: ctx.workspace.id, entryId: id }).catch(() => {});
  }

  // Webhook sólo por las que realmente transicionaron
  for (const { id } of transitioned) {
    emitAsync({ workspaceId: ctx.workspace.id, event: "entry.published", payload: { id } });
  }

  revalidatePath("/admin/contenido");
  revalidatePath("/blog");
  return { ok: true as const, count: parsed.data.ids.length };
}

export async function unpublishEntriesAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const parsed = StatusActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  // Sólo emitimos webhook por las que realmente estaban publicadas.
  const transitioned = await db
    .update(entries)
    .set({ status: "draft", updatedById: user.id, updatedAt: new Date() })
    .where(
      and(
        eq(entries.workspaceId, ctx.workspace.id),
        inArray(entries.id, parsed.data.ids),
        eq(entries.status, "published"),
      ),
    )
    .returning({ id: entries.id });

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "entries.unpublished",
    targetType: "entry",
    meta: { count: transitioned.length, requested: parsed.data.ids.length },
  });

  for (const { id } of transitioned) {
    emitAsync({ workspaceId: ctx.workspace.id, event: "entry.unpublished", payload: { id } });
  }

  revalidatePath("/admin/contenido");
  revalidatePath("/blog");
  return { ok: true as const, count: parsed.data.ids.length };
}

const ScheduleSchema = z.object({
  id: z.string().uuid(),
  scheduledAt: z.string().datetime(),
});

export async function scheduleEntryAction(input: z.input<typeof ScheduleSchema>) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  await db
    .update(entries)
    .set({
      status: "scheduled",
      scheduledAt: new Date(parsed.data.scheduledAt),
      updatedById: user.id,
      updatedAt: new Date(),
    })
    .where(and(eq(entries.workspaceId, ctx.workspace.id), eq(entries.id, parsed.data.id)));

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "entry.scheduled",
    targetType: "entry",
    targetId: parsed.data.id,
    meta: { at: parsed.data.scheduledAt },
  });

  revalidatePath(`/admin/contenido/${parsed.data.id}`);
  revalidatePath("/admin/contenido");
  return { ok: true as const };
}

export async function archiveEntriesAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const parsed = StatusActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  await db
    .update(entries)
    .set({ status: "archived", updatedById: user.id, updatedAt: new Date() })
    .where(and(eq(entries.workspaceId, ctx.workspace.id), inArray(entries.id, parsed.data.ids)));

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "entries.archived",
    targetType: "entry",
    meta: { count: parsed.data.ids.length },
  });

  revalidatePath("/admin/contenido");
  return { ok: true as const, count: parsed.data.ids.length };
}

export async function deleteEntriesAction(input: { ids: string[] }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("admin");
  if (!db) return { ok: false as const, error: "DB no configurada" };
  const parsed = StatusActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };

  await db
    .delete(entries)
    .where(and(eq(entries.workspaceId, ctx.workspace.id), inArray(entries.id, parsed.data.ids)));

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "entries.deleted",
    targetType: "entry",
    meta: { count: parsed.data.ids.length },
  });

  for (const id of parsed.data.ids) {
    emitAsync({ workspaceId: ctx.workspace.id, event: "entry.deleted", payload: { id } });
  }

  revalidatePath("/admin/contenido");
  revalidatePath("/blog");
  return { ok: true as const, count: parsed.data.ids.length };
}

export async function restoreRevisionAction(input: { entryId: string; revisionId: string }) {
  const user = await requireUser();
  const ctx = await requireWorkspace("editor");
  if (!db) return { ok: false as const, error: "DB no configurada" };

  const entry = await getEntryById(ctx.workspace.id, input.entryId);
  if (!entry) return { ok: false as const, error: "No encontrada" };

  const rev = await getRevision(input.revisionId);
  if (!rev || rev.entryId !== entry.id) {
    return { ok: false as const, error: "Revisión inválida" };
  }

  const bodyText = bodyToText(rev.body);
  await db.transaction(async (tx) => {
    await tx.insert(revisions).values({
      entryId: entry.id,
      body: entry.body as never,
      summary: `Antes de restaurar ${rev.id.slice(0, 8)}`,
      authorId: user.id,
    });
    await tx
      .update(entries)
      .set({
        body: rev.body as never,
        bodyText,
        updatedById: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(entries.id, entry.id), eq(entries.workspaceId, ctx.workspace.id)));
  });

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    action: "entry.restored",
    targetType: "entry",
    targetId: entry.id,
    meta: { revisionId: rev.id },
  });

  revalidatePath(`/admin/contenido/${entry.id}`);
  if (entry.status === "published") {
    revalidatePath("/blog");
    revalidateTag(`post:${ctx.workspace.slug}:${entry.slug}`);
  }
  return { ok: true as const };
}
