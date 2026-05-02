import { db } from "@/db/client";
import { media, mediaFolders } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import {
  type NonImageStored,
  type ProcessedImage,
  isProcessableImage,
  processAndStoreImage,
  storeRawFile,
} from "@/lib/image-processor";
import type { MediaKind, MediaRow } from "@/lib/media-types";
import { isUuid } from "@/lib/uuid";
import { currentStorage } from "@/storage";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export { mediaKind } from "@/lib/media-types";
export type { MediaKind, MediaRow } from "@/lib/media-types";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Nota: image/svg+xml está excluido a propósito hasta tener un sanitizer DOM
// (DOMPurify-style) que limpie scripts/handlers. Servirlo desde el mismo
// origen permitiría XSS en sesión del workspace.
export const ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/tiff",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
]);

export type IngestInput = {
  workspaceId: string;
  uploadedById: string | null;
  folderId?: string | null;
  filename: string;
  mime: string;
  buffer: Buffer;
};

export type IngestedAsset = MediaRow;

/**
 * Pipeline central: procesa el binario (si es imagen, genera variantes + blurhash + dom-color),
 * guarda en storage y crea la fila en `media`.
 */
export async function ingestUpload(input: IngestInput): Promise<IngestedAsset> {
  if (!db) throw new Error("DB not configured");
  if (input.buffer.length === 0) throw new Error("Archivo vacío");
  if (input.buffer.length > MAX_UPLOAD_BYTES) throw new Error("Archivo demasiado grande");
  if (!ALLOWED_MIME.has(input.mime)) throw new Error(`Tipo no permitido: ${input.mime}`);

  const assetId = nanoid(16);
  const writtenKeys: string[] = [];
  const storage = currentStorage();

  // Compensación: si algo falla tras subir bytes, los borramos best-effort
  // para evitar archivos huérfanos en el adapter.
  async function rollback() {
    await Promise.all(writtenKeys.map((k) => storage.delete(k).catch(() => null)));
  }

  let processed: ProcessedImage | null = null;
  let raw: NonImageStored | null = null;

  try {
    if (isProcessableImage(input.mime)) {
      processed = await processAndStoreImage({
        workspaceId: input.workspaceId,
        assetId,
        buffer: input.buffer,
        mime: input.mime,
        onKeyWritten: (k) => writtenKeys.push(k),
      });
    } else {
      raw = await storeRawFile(
        input.workspaceId,
        assetId,
        input.buffer,
        input.mime,
        input.filename,
      );
      writtenKeys.push(raw.key);
    }
  } catch (err) {
    await rollback();
    throw err;
  }

  const baseRow = {
    workspaceId: input.workspaceId,
    folderId: input.folderId ?? null,
    uploadedById: input.uploadedById,
    filename: input.filename,
    mime: input.mime,
  };

  const values = processed
    ? {
        ...baseRow,
        key: processed.variants.original.key,
        url: processed.variants.original.url,
        size: processed.size,
        width: processed.width,
        height: processed.height,
        blurhash: processed.blurhash || null,
        dominantColor: processed.dominantColor || null,
        hasTransparency: processed.hasTransparency,
        exifStripped: true,
        variants: processed.variants as never,
      }
    : raw
      ? {
          ...baseRow,
          key: raw.key,
          url: raw.url,
          size: raw.size,
        }
      : null;
  if (!values) {
    await rollback();
    throw new Error("No se pudo procesar el archivo");
  }

  let row: MediaRow | undefined;
  try {
    [row] = await db.insert(media).values(values).returning();
  } catch (err) {
    await rollback();
    throw err;
  }
  if (!row) {
    await rollback();
    throw new Error("No se pudo crear la fila de media");
  }

  await logActivity({
    workspaceId: input.workspaceId,
    actorId: input.uploadedById,
    action: "media.upload",
    targetType: "media",
    targetId: row.id,
    meta: { filename: input.filename, mime: input.mime, size: input.buffer.length },
  });

  return row;
}

export type ListMediaParams = {
  workspaceId: string;
  folderId?: string | null;
  q?: string;
  type?: MediaKind | "all";
  altMissing?: boolean;
  limit?: number;
  offset?: number;
  sort?: "newest" | "oldest" | "size";
};

export async function listMedia(params: ListMediaParams): Promise<{
  rows: MediaRow[];
  total: number;
}> {
  if (!db) return { rows: [], total: 0 };
  const limit = Math.min(params.limit ?? 60, 200);
  const offset = params.offset ?? 0;

  const conds = [eq(media.workspaceId, params.workspaceId)];
  if (params.folderId === null) conds.push(isNull(media.folderId));
  else if (params.folderId) conds.push(eq(media.folderId, params.folderId));

  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    const filter = or(
      ilike(media.filename, term),
      ilike(media.alt, term),
      ilike(media.caption, term),
    );
    if (filter) conds.push(filter);
  }

  if (params.type && params.type !== "all") {
    if (params.type === "image") conds.push(ilike(media.mime, "image/%"));
    else if (params.type === "video") conds.push(ilike(media.mime, "video/%"));
    else if (params.type === "audio") conds.push(ilike(media.mime, "audio/%"));
    else if (params.type === "doc") {
      const docFilter = or(eq(media.mime, "application/pdf"), ilike(media.mime, "text/%"));
      if (docFilter) conds.push(docFilter);
    }
  }

  if (params.altMissing) {
    const altFilter = or(isNull(media.alt), eq(media.alt, ""));
    if (altFilter) conds.push(altFilter);
  }

  const where = and(...conds);
  const order =
    params.sort === "oldest"
      ? asc(media.createdAt)
      : params.sort === "size"
        ? desc(media.size)
        : desc(media.createdAt);

  const [rows, totalRow] = await Promise.all([
    db.select().from(media).where(where).orderBy(order).limit(limit).offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(media).where(where),
  ]);

  return { rows, total: totalRow[0]?.n ?? 0 };
}

export async function getMediaById(workspaceId: string, id: string): Promise<MediaRow | null> {
  if (!db) return null;
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function deleteMedia(workspaceId: string, ids: string[]): Promise<number> {
  if (!db) return 0;
  const valid = ids.filter(isUuid);
  if (valid.length === 0) return 0;
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.workspaceId, workspaceId), inArray(media.id, valid)));

  const storage = currentStorage();
  await Promise.all(
    rows.flatMap((row) => {
      const ops: Promise<unknown>[] = [storage.delete(row.key).catch(() => null)];
      const variants = row.variants as {
        sizes?: Record<string, Record<string, { key?: string }>>;
      } | null;
      if (variants?.sizes) {
        for (const sz of Object.values(variants.sizes)) {
          for (const v of Object.values(sz)) {
            if (v?.key) ops.push(storage.delete(v.key).catch(() => null));
          }
        }
      }
      return ops;
    }),
  );

  const deleted = await db
    .delete(media)
    .where(and(eq(media.workspaceId, workspaceId), inArray(media.id, valid)))
    .returning({ id: media.id });

  await logActivity({
    workspaceId,
    action: "media.delete",
    targetType: "media",
    meta: { count: deleted.length },
  });

  return deleted.length;
}

export type UpdateMediaPatch = {
  alt?: string | null;
  caption?: string | null;
  folderId?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  tagsManual?: string[] | null;
};

export async function updateMedia(
  workspaceId: string,
  id: string,
  patch: UpdateMediaPatch,
): Promise<MediaRow | null> {
  if (!db) return null;
  if (!isUuid(id)) return null;
  const next: Record<string, unknown> = {};
  if (patch.alt !== undefined) next.alt = patch.alt;
  if (patch.caption !== undefined) next.caption = patch.caption;
  if (patch.folderId !== undefined) next.folderId = patch.folderId;
  if (patch.focalX !== undefined) next.focalX = patch.focalX;
  if (patch.focalY !== undefined) next.focalY = patch.focalY;
  if (patch.tagsManual !== undefined) next.tagsManual = patch.tagsManual;
  if (Object.keys(next).length === 0) return getMediaById(workspaceId, id);
  const [row] = await db
    .update(media)
    .set(next)
    .where(and(eq(media.id, id), eq(media.workspaceId, workspaceId)))
    .returning();
  return row ?? null;
}

// ---------- folders ----------
export async function listFolders(workspaceId: string) {
  if (!db) return [];
  return db
    .select()
    .from(mediaFolders)
    .where(eq(mediaFolders.workspaceId, workspaceId))
    .orderBy(asc(mediaFolders.name));
}

export async function createFolder(
  workspaceId: string,
  name: string,
  parentId: string | null,
): Promise<typeof mediaFolders.$inferSelect> {
  if (!db) throw new Error("DB not configured");
  const cleanName = name.trim().slice(0, 60) || "Sin nombre";
  // Evita duplicados (case-insensitive) en el mismo padre.
  const dupConds = [eq(mediaFolders.workspaceId, workspaceId), ilike(mediaFolders.name, cleanName)];
  if (parentId) dupConds.push(eq(mediaFolders.parentId, parentId));
  else dupConds.push(isNull(mediaFolders.parentId));
  const dup = await db
    .select({ id: mediaFolders.id })
    .from(mediaFolders)
    .where(and(...dupConds))
    .limit(1);
  if (dup[0]) throw new Error("Ya existe una carpeta con ese nombre");

  const [row] = await db
    .insert(mediaFolders)
    .values({ workspaceId, name: cleanName, parentId })
    .returning();
  if (!row) throw new Error("No se pudo crear la carpeta");
  return row;
}

export async function deleteFolder(workspaceId: string, id: string): Promise<boolean> {
  if (!db) return false;
  if (!isUuid(id)) return false;
  // Mueve los assets de esa carpeta a la raíz antes de borrar.
  await db
    .update(media)
    .set({ folderId: null })
    .where(and(eq(media.workspaceId, workspaceId), eq(media.folderId, id)));
  const deleted = await db
    .delete(mediaFolders)
    .where(and(eq(mediaFolders.workspaceId, workspaceId), eq(mediaFolders.id, id)))
    .returning({ id: mediaFolders.id });
  return deleted.length > 0;
}
