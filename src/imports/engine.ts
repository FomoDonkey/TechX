import { db } from "@/db/client";
import { deleteReturningCount, insertReturning, upsertReturning } from "@/db/dialect";
import {
  collections,
  comments,
  entries,
  entryTerms,
  importItems,
  imports,
  taxonomies,
  terms as termsTable,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { POSTS_SLUG, ensureUniqueEntrySlug, getOrCreateBuiltinCollection } from "@/lib/entries";
import { ingestUpload } from "@/lib/media";
import { slugify } from "@/lib/slug";
import { safePublicFetch } from "@/lib/ssrf";
import { createRedirect } from "@/redirects/lib";
import { currentStorage } from "@/storage";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  type TiptapDoc,
  contentToBodyText,
  htmlToTiptap,
  markdownToTiptap,
} from "./content-convert";
import { clearImport, emit } from "./events";
import { getParser } from "./registry";
import {
  EMPTY_STATS,
  type ImportMapping,
  type ImportStats,
  type RawComment,
  type RawEntry,
} from "./types";

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB doc cap
const MAX_MEDIA_PER_ENTRY = 30;
const MEDIA_FETCH_TIMEOUT_MS = 15_000;
/** Hard cap anti-DoS: un import individual no puede superar este nº de items. */
const MAX_ITEMS_PER_IMPORT = 50_000;
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

type EngineCtx = {
  workspaceId: string;
  userId: string | null;
  importId: string;
  dryRun: boolean;
  stats: ImportStats;
  /** sourceId → entryId, populated as entries are imported (for comment linking). */
  entryBySource: Map<string, string>;
  /** taxonomy "category" id (lazy created). */
  categoryTaxonomyId: string | null;
  /** taxonomy "tag" id (lazy created). */
  tagTaxonomyId: string | null;
  /** termSlug → termId cache para no spam-querear. */
  termCache: Map<string, string>;
  /** mediaPolicy del import row. */
  mediaPolicy: "download" | "link" | "skip";
  /** Parser que generó los items — necesario para originRef único por source. */
  source: string;
  collectionId: string;
  defaultLocale: string;
  defaultStatus: "draft" | "published";
  createRedirects: boolean;
};

async function getOrCreateTaxonomy(workspaceId: string, type: "category" | "tag"): Promise<string> {
  if (!db) throw new Error("DB not configured");
  const slug = type === "category" ? "categorias" : "etiquetas";
  const existing = await db
    .select()
    .from(taxonomies)
    .where(and(eq(taxonomies.workspaceId, workspaceId), eq(taxonomies.slug, slug)))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const newId = crypto.randomUUID();
  const created = (await insertReturning(taxonomies, {
    id: newId,
    workspaceId,
    name: type === "category" ? "Categorías" : "Etiquetas",
    slug,
    type,
  })) as typeof taxonomies.$inferSelect;
  if (!created) throw new Error("No se pudo crear la taxonomía");
  return created.id;
}

async function getOrCreateTerm(
  ctx: EngineCtx,
  taxonomyType: "category" | "tag",
  name: string,
): Promise<string | null> {
  if (!db) return null;
  const slug = slugify(name);
  if (!slug) return null;
  const cacheKey = `${taxonomyType}:${slug}`;
  const cached = ctx.termCache.get(cacheKey);
  if (cached) return cached;

  let taxId = taxonomyType === "category" ? ctx.categoryTaxonomyId : ctx.tagTaxonomyId;
  if (!taxId) {
    taxId = await getOrCreateTaxonomy(ctx.workspaceId, taxonomyType);
    if (taxonomyType === "category") ctx.categoryTaxonomyId = taxId;
    else ctx.tagTaxonomyId = taxId;
  }

  const existing = await db
    .select({ id: termsTable.id })
    .from(termsTable)
    .where(and(eq(termsTable.taxonomyId, taxId), eq(termsTable.slug, slug)))
    .limit(1);
  if (existing[0]) {
    ctx.termCache.set(cacheKey, existing[0].id);
    return existing[0].id;
  }
  const newId = crypto.randomUUID();
  const created = (await insertReturning(termsTable, {
    id: newId,
    taxonomyId: taxId,
    name,
    slug,
  })) as typeof termsTable.$inferSelect;
  if (!created) return null;
  ctx.termCache.set(cacheKey, created.id);
  return created.id;
}

/**
 * Build origin reference para idempotencia inter-lote. El `source` debe ser
 * el parser real (`wordpress`, `notion`, `csv`...), NO el literal "import".
 * Sin esto, un WP post con id 42 colisionaba con un Notion page con id "42",
 * y el segundo importaba sobreescribiendo el primero.
 */
function buildOriginRef(source: string, kind: string, sourceId: string): string {
  return `${source}:${kind}:${sourceId}`.slice(0, 256);
}

/**
 * Sanitiza un objeto de `fields` antes de persistirlo en `entries.fields`.
 * Bloquea claves reservadas del CMS o prefixes peligrosos para evitar que
 * un CSV con headers maliciosos sobreescriba campos sensibles. Las claves
 * legítimas del importer (`wpPostType`, `notionAssets`, etc.) están
 * controladas por código nuestro y no chocan; el resto se prefija
 * `import_` para namespace defensivo.
 */
const RESERVED_FIELD_KEYS = new Set([
  "_import",
  "_origin",
  "_internal",
  "workspaceId",
  "id",
  "coverId",
  "folderId",
  "authorId",
  "collectionId",
  "branchId",
  "originRef",
  "embedding",
  "__proto__",
  "constructor",
  "prototype",
]);

const TRUSTED_FIELD_KEYS = new Set([
  "wpPostType",
  "notionAssets",
  "notionProps",
  "ghostType",
  "ghostVisibility",
  "seoTitle",
]);

function sanitizeImportedFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (RESERVED_FIELD_KEYS.has(key)) continue;
    if (TRUSTED_FIELD_KEYS.has(key)) {
      out[key] = value;
      continue;
    }
    // Cualquier clave extraña (típicamente columnas CSV) → prefijada
    const safeKey = `import_${key}`.slice(0, 60);
    out[safeKey] = value;
  }
  return out;
}

/** Strip control chars (anti-XSS via UI fields rendered without escaping). */
function stripDangerousChars(s: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: anti-XSS para títulos/excerpts importados
  return s.replace(/[\x00-\x1f\x7f]/g, " ").trim();
}

/**
 * Bajar una imagen externa (vía SSRF-safe fetch) e ingestarla en /media.
 * Devuelve la URL pública resultante o null si falla.
 */
async function downloadMediaToWorkspace(
  ctx: EngineCtx,
  url: string,
): Promise<{ id: string; url: string } | null> {
  if (!db) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MEDIA_FETCH_TIMEOUT_MS);
  try {
    const res = await safePublicFetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!ALLOWED_IMAGE_MIME.has(ct)) return null;
    const len = Number.parseInt(res.headers.get("content-length") ?? "0", 10);
    if (len > 20 * 1024 * 1024) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) return null;
    const filename = url.split("/").pop()?.split("?")[0] ?? "imported";
    const row = await ingestUpload({
      workspaceId: ctx.workspaceId,
      uploadedById: ctx.userId,
      folderId: null,
      filename,
      mime: ct,
      buffer: buf,
    });
    ctx.stats.mediaImported += 1;
    return { id: row.id, url: row.url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Recorre body Tiptap y reescribe imágenes externas según mediaPolicy.
 * Retorna nuevo doc + cuenta de imágenes procesadas.
 */
async function applyMediaPolicy(
  ctx: EngineCtx,
  doc: TiptapDoc,
): Promise<{ doc: TiptapDoc; imageCount: number }> {
  if (ctx.mediaPolicy === "link") return { doc, imageCount: countImages(doc) };

  let imageCount = 0;

  async function walk(node: {
    type: string;
    content?: unknown[];
    attrs?: Record<string, unknown>;
  }): Promise<void> {
    if (node.type === "image") {
      imageCount += 1;
      ctx.stats.mediaPlanned += 1;
      const src = node.attrs?.src;
      // skip mode SIEMPRE limpia, incluso si excedimos el cap; el cap solo
      // limita el download (caro). Promesa de UI: "Quitar todas las
      // imágenes" debe ser literal.
      if (ctx.mediaPolicy === "skip") {
        node.attrs = { ...(node.attrs ?? {}), src: "" };
        return;
      }
      if (typeof src !== "string" || !/^https?:\/\//i.test(src)) return;
      if (imageCount > MAX_MEDIA_PER_ENTRY) return; // cap solo aplica a download
      if (ctx.dryRun) return;
      const downloaded = await downloadMediaToWorkspace(ctx, src);
      if (downloaded) {
        node.attrs = { ...(node.attrs ?? {}), src: downloaded.url };
      }
    }
    const children = node.content;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object") {
          await walk(child as never);
        }
      }
    }
  }

  await walk(doc as never);
  return { doc, imageCount };
}

function countImages(doc: { content?: unknown[] }): number {
  let n = 0;
  function walk(node: { type?: string; content?: unknown[] }): void {
    if (node.type === "image") n++;
    if (Array.isArray(node.content)) {
      for (const c of node.content) {
        if (c && typeof c === "object") walk(c as never);
      }
    }
  }
  walk(doc);
  return n;
}

function statusFromMapping(
  raw: RawEntry,
  mapping: ImportMapping,
): "draft" | "scheduled" | "published" | "archived" | "review" {
  const v = raw.status ?? mapping.defaultStatus ?? "draft";
  return v === "published" ? "published" : "draft";
}

async function importEntry(
  ctx: EngineCtx,
  raw: RawEntry,
  mapping: ImportMapping,
): Promise<{ ok: boolean; error?: string; targetId?: string }> {
  if (!db) return { ok: false, error: "DB not configured" };

  // Para CSV sin id explícito (sourceId="row-N"), añadimos el importId al
  // originRef para evitar colisiones inter-lote: dos CSVs distintos sin id
  // colisionarían en "row-1" y el segundo sobreescribiría el primero.
  const isAutoCsvId = ctx.source === "csv" && /^row-\d+$/.test(raw.sourceId);
  const sourceId = isAutoCsvId ? `${ctx.importId}:${raw.sourceId}` : raw.sourceId;
  const originRef = buildOriginRef(ctx.source, "entry", sourceId);
  // ¿Existe ya por originRef?
  const existing = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.workspaceId, ctx.workspaceId), eq(entries.originRef, originRef)))
    .limit(1);
  const existingId = existing[0]?.id;

  const baseSlug = slugify(raw.slug ?? raw.title) || "sin-titulo";
  const slug = await ensureUniqueEntrySlug(
    ctx.workspaceId,
    ctx.collectionId,
    ctx.defaultLocale,
    baseSlug,
    existingId,
  );

  // Convertir contenido
  let doc: TiptapDoc;
  if (raw.contentFormat === "markdown") {
    doc = markdownToTiptap(raw.content ?? "");
  } else {
    doc = htmlToTiptap(raw.content ?? "");
  }
  const docJson = JSON.stringify(doc);
  if (docJson.length > MAX_BODY_BYTES) {
    return { ok: false, error: `Body excede ${MAX_BODY_BYTES} bytes` };
  }
  const { doc: finalDoc } = await applyMediaPolicy(ctx, doc);

  const status = statusFromMapping(raw, mapping);

  if (ctx.dryRun) {
    return { ok: true };
  }

  let targetId: string;
  if (existingId) {
    // Merge fields en re-import en lugar de replace — preserva ediciones
    // manuales del admin sobre custom fields entre re-runs del mismo lote.
    // SQL-side coalesce para evitar race con escrituras concurrentes.
    const sanitizedNew = sanitizeImportedFields(raw.fields ?? {});
    await db
      .update(entries)
      .set({
        title: stripDangerousChars(raw.title).slice(0, 200),
        slug,
        excerpt: stripDangerousChars(raw.excerpt ?? "").slice(0, 500) || null,
        body: finalDoc as unknown as Record<string, unknown>,
        bodyText: contentToBodyText(raw.content ?? ""),
        status,
        publishedAt: raw.publishedAt ?? null,
        fields: sql`coalesce(${entries.fields}, '{}'::jsonb) || ${JSON.stringify({ ...sanitizedNew, _import: ctx.importId })}::jsonb`,
        updatedAt: new Date(),
      })
      // L8: defense-in-depth — añade workspaceId aunque el lookup ya garantiza
      // que existingId pertenece al workspace correcto.
      .where(and(eq(entries.id, existingId), eq(entries.workspaceId, ctx.workspaceId)));
    const [updated] = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.id, existingId), eq(entries.workspaceId, ctx.workspaceId)))
      .limit(1);
    targetId = updated?.id ?? existingId;
  } else {
    const sanitizedNew = sanitizeImportedFields(raw.fields ?? {});
    const newId = crypto.randomUUID();
    const created = (await insertReturning(entries, {
      id: newId,
      workspaceId: ctx.workspaceId,
      collectionId: ctx.collectionId,
      title: stripDangerousChars(raw.title).slice(0, 200),
      slug,
      excerpt: stripDangerousChars(raw.excerpt ?? "").slice(0, 500) || null,
      body: finalDoc as unknown as Record<string, unknown>,
      bodyText: contentToBodyText(raw.content ?? ""),
      locale: ctx.defaultLocale,
      status,
      publishedAt: raw.publishedAt ?? null,
      authorId: ctx.userId,
      updatedById: ctx.userId,
      fields: { ...sanitizedNew, _import: ctx.importId },
      originRef,
    })) as typeof entries.$inferSelect;
    if (!created) return { ok: false, error: "No se pudo insertar entry" };
    targetId = created.id;
  }
  ctx.entryBySource.set(raw.sourceId, targetId);

  // Categorías + tags
  const termIds: string[] = [];
  if (raw.categories?.length) {
    for (const name of raw.categories) {
      const tid = await getOrCreateTerm(ctx, "category", name);
      if (tid) termIds.push(tid);
    }
  }
  if (raw.tags?.length) {
    for (const name of raw.tags) {
      const tid = await getOrCreateTerm(ctx, "tag", name);
      if (tid) termIds.push(tid);
    }
  }
  if (termIds.length > 0) {
    // Borra previos antes de insertar (idempotente en re-run)
    await db.delete(entryTerms).where(eq(entryTerms.entryId, targetId));
    await db
      .insert(entryTerms)
      .values(termIds.map((termId) => ({ entryId: targetId, termId })))
      .onConflictDoNothing();
  }

  // Redirect auto si tenía URL original. Usamos createRedirect() para que
  // pase por validateRule + isSafeDestination (anti open-redirect, anti
  // protocol-relative, anti control chars). Además bloqueamos prefijos
  // reservados del CMS — un import malicioso podría inyectar un 301 desde
  // /admin/contenido o /api/* y secuestrar navegación interna.
  if (ctx.createRedirects && raw.sourceUrl && !ctx.dryRun) {
    try {
      const srcPath = new URL(raw.sourceUrl).pathname || "/";
      const destPath = `/${slug}`;
      const RESERVED_PREFIXES = [
        "/admin",
        "/api",
        "/_next",
        "/onboarding",
        "/login",
        "/registro",
        "/olvide",
        "/invitacion",
        "/miembros",
        "/preview",
        "/checkout",
      ];
      const isReserved = RESERVED_PREFIXES.some(
        (p) => srcPath === p || srcPath.startsWith(`${p}/`),
      );
      if (srcPath !== destPath && srcPath !== "/" && !isReserved) {
        try {
          await createRedirect({
            workspaceId: ctx.workspaceId,
            source: srcPath,
            destination: destPath,
            statusCode: 301,
            matchType: "exact",
            preserveQuery: true,
            createdById: ctx.userId ?? undefined,
          });
        } catch {
          // validateRule falló o duplicado — silencioso, no es bloqueante
        }
      }
    } catch {
      // URL inválida; no creamos redirect
    }
  }

  return { ok: true, targetId };
}

async function importComment(
  ctx: EngineCtx,
  raw: RawComment,
): Promise<{ ok: boolean; error?: string; targetId?: string }> {
  if (!db) return { ok: false, error: "DB not configured" };
  const entryId = ctx.entryBySource.get(raw.entrySourceId);
  if (!entryId) return { ok: false, error: "Entry padre no encontrada" };
  if (ctx.dryRun) return { ok: true };
  const newId = crypto.randomUUID();
  const created = (await insertReturning(comments, {
    id: newId,
    workspaceId: ctx.workspaceId,
    entryId,
    authorName: raw.author.slice(0, 100),
    // authorEmail es notNull en schema; sin email persistimos placeholder
    authorEmail: raw.email?.slice(0, 200) ?? "imported@unknown",
    body: raw.body.slice(0, 5000),
    status: raw.status === "spam" ? "spam" : raw.status === "pending" ? "pending" : "approved",
    createdAt: raw.createdAt ?? new Date(),
  })) as typeof comments.$inferSelect;
  return created
    ? { ok: true, targetId: created.id }
    : { ok: false, error: "No se pudo insertar comment" };
}

export type RunImportOpts = {
  importId: string;
  workspaceId: string;
  userId: string | null;
};

export async function runImport(opts: RunImportOpts): Promise<ImportStats> {
  if (!db) throw new Error("DB not configured");
  // El claim atómico ya lo hizo el endpoint /run (UPDATE ... RETURNING).
  // Aquí asumimos status='running' y leemos la fila para acceder a fileKey,
  // mapping, mediaPolicy, dryRun.
  const [row] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, opts.importId), eq(imports.workspaceId, opts.workspaceId)))
    .limit(1);
  if (!row) throw new Error("Import no encontrado");
  if (row.status !== "running") {
    throw new Error(`Estado inesperado ${row.status}; el claim atómico falló`);
  }

  const mapping = (row.mapping ?? {}) as ImportMapping;
  if (!mapping.collectionId) throw new Error("Falta collectionId en el mapping");

  // Asegura colección — y CRÍTICAMENTE valida que pertenece al workspace.
  // Sin este check, un editor podía editar mapping vía PATCH con un
  // collectionId de OTRO workspace y al ejecutar engine, las entries
  // quedaban con `entries.workspaceId = wsA` pero `collectionId = wsB`.
  // Estado inconsistente + queries cross-tenant en /admin/contenido.
  let collectionId = mapping.collectionId;
  if (collectionId === "_builtin_posts") {
    const coll = await getOrCreateBuiltinCollection(opts.workspaceId, POSTS_SLUG);
    collectionId = coll.id;
  } else {
    const owned = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.workspaceId, opts.workspaceId)))
      .limit(1);
    if (!owned[0]) {
      const msg = "Colección destino no pertenece al workspace";
      await db
        .update(imports)
        .set({ status: "failed", completedAt: new Date(), errorLog: [msg] })
        .where(eq(imports.id, opts.importId));
      throw new Error(msg);
    }
  }

  // status='running' y errorLog=[] ya quedaron seteados por el claim atómico
  // del endpoint /run. Sólo emitimos el inicio.
  emit(opts.importId, { type: "phase", phase: "parsing" });

  const stats: ImportStats = { ...EMPTY_STATS };
  const errorLog: string[] = [];

  // Cargar archivo desde storage
  let buf: Buffer;
  try {
    if (!row.fileKey) throw new Error("Sin fileKey");
    const storage = currentStorage();
    const got = await storage.get(row.fileKey);
    if (!got) throw new Error("Archivo no encontrado en storage");
    buf = got;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error cargando archivo";
    await db
      .update(imports)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorLog: [msg],
        stats,
      })
      .where(eq(imports.id, opts.importId));
    emit(opts.importId, { type: "error", message: msg });
    emit(opts.importId, { type: "complete", stats });
    return stats;
  }

  const parser = getParser(row.source);
  const ctx: EngineCtx = {
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    importId: opts.importId,
    dryRun: row.dryRun,
    stats,
    entryBySource: new Map(),
    categoryTaxonomyId: null,
    tagTaxonomyId: null,
    termCache: new Map(),
    mediaPolicy: row.mediaPolicy,
    source: row.source,
    collectionId,
    defaultLocale: mapping.defaultLocale ?? "es",
    defaultStatus: mapping.defaultStatus ?? "draft",
    createRedirects: mapping.createRedirects ?? true,
  };

  emit(opts.importId, { type: "phase", phase: "running" });

  try {
    for await (const item of parser.parse(buf, { dryRun: row.dryRun })) {
      // Hard cap anti-DoS: corta el stream si supera el límite del lote
      if (stats.detected >= MAX_ITEMS_PER_IMPORT) {
        errorLog.push(`Cap alcanzado (${MAX_ITEMS_PER_IMPORT} items) — items extra ignorados`);
        break;
      }
      stats.detected += 1;
      stats.planned += 1;

      // Persist log row (idempotente intra-lote vía upsert DoNothing).
      let itemId: string | null = null;
      if (!row.dryRun) {
        const newItemId = crypto.randomUUID();
        const logged = await upsertReturning(importItems, {
          values: {
            id: newItemId,
            importId: opts.importId,
            workspaceId: opts.workspaceId,
            kind: item.kind,
            sourceId: item.sourceId,
            sourceUrl: item.kind === "entry" ? item.sourceUrl : null,
            status: "pending",
          },
          target: [importItems.importId, importItems.kind, importItems.sourceId],
          uniqueKey: {
            importId: opts.importId,
            kind: item.kind,
            sourceId: item.sourceId,
          },
          set: null,
        });
        itemId = (logged.id as string | undefined) ?? null;
      }

      try {
        let result: { ok: boolean; error?: string; targetId?: string; skipped?: boolean };
        if (item.kind === "entry") {
          result = await importEntry(ctx, item, { ...mapping, collectionId });
        } else if (item.kind === "comment") {
          result = await importComment(ctx, item);
        } else if (item.kind === "term") {
          const tid = await getOrCreateTerm(ctx, item.taxonomy, item.name);
          result = tid ? { ok: true, targetId: tid } : { ok: true, skipped: true };
        } else {
          // media standalone: las imágenes inline se procesan vía
          // applyMediaPolicy en el body. Aquí marcamos como skipped para
          // distinguir de imported/errored en stats.
          result = { ok: true, skipped: true };
        }

        if (result.skipped) {
          stats.skipped += 1;
          if (itemId && !row.dryRun) {
            await db
              .update(importItems)
              .set({ status: "skipped", importedAt: new Date() })
              .where(eq(importItems.id, itemId));
          }
          emit(opts.importId, { type: "item", status: "imported", kind: item.kind });
        } else if (result.ok) {
          stats.imported += 1;
          if (itemId && !row.dryRun) {
            await db
              .update(importItems)
              .set({
                status: "imported",
                targetId: result.targetId ?? null,
                importedAt: new Date(),
              })
              .where(eq(importItems.id, itemId));
          }
          emit(opts.importId, {
            type: "item",
            status: "imported",
            kind: item.kind,
            title: item.kind === "entry" ? item.title : undefined,
          });
        } else {
          stats.errored += 1;
          if (errorLog.length < 100)
            errorLog.push(`${item.kind}:${item.sourceId} → ${result.error}`);
          if (itemId && !row.dryRun) {
            await db
              .update(importItems)
              .set({ status: "failed", error: result.error ?? null })
              .where(eq(importItems.id, itemId));
          }
          emit(opts.importId, {
            type: "item",
            status: "failed",
            kind: item.kind,
            title: result.error,
          });
        }
      } catch (err) {
        stats.errored += 1;
        const msg = err instanceof Error ? err.message : "error";
        if (errorLog.length < 100) errorLog.push(`${item.kind}:${item.sourceId} → ${msg}`);
        if (itemId && !row.dryRun) {
          await db
            .update(importItems)
            .set({ status: "failed", error: msg })
            .where(eq(importItems.id, itemId));
        }
        emit(opts.importId, { type: "item", status: "failed", kind: item.kind, title: msg });
      }

      // Stats periódicas cada 5 items
      if (stats.detected % 5 === 0) {
        emit(opts.importId, { type: "stats", stats: { ...stats } });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error en parser";
    errorLog.push(`parser → ${msg}`);
    stats.errored += 1;
  }

  await db
    .update(imports)
    .set({
      status: stats.errored > 0 && stats.imported === 0 ? "failed" : "completed",
      completedAt: new Date(),
      stats,
      errorLog,
    })
    .where(eq(imports.id, opts.importId));

  emit(opts.importId, { type: "stats", stats });
  emit(opts.importId, { type: "phase", phase: "done" });
  emit(opts.importId, { type: "complete", stats });

  // Liberamos buffer del bus de eventos tras 60s — suficiente para que el
  // último cliente SSE consuma el `complete` y se desconecte. Sin esto el
  // Map crece indefinidamente.
  setTimeout(() => clearImport(opts.importId), 60_000).unref?.();

  if (!row.dryRun) {
    await logActivity({
      workspaceId: opts.workspaceId,
      actorId: opts.userId,
      action: "import.completed",
      targetType: "import",
      targetId: opts.importId,
      meta: { source: row.source, ...stats },
    });
  }

  return stats;
}

/**
 * Revert: borra todos los entries (y por cascade entryTerms, comments, revisions)
 * que se importaron en este lote. Marca imports.status=reverted.
 */
export async function revertImport(opts: {
  importId: string;
  workspaceId: string;
  userId: string | null;
}): Promise<{ deleted: number }> {
  if (!db) throw new Error("DB not configured");

  const [row] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, opts.importId), eq(imports.workspaceId, opts.workspaceId)))
    .limit(1);
  if (!row) throw new Error("Import no encontrado");
  if (row.status === "reverted") return { deleted: 0 };

  // Encuentra entries importadas. Defense-in-depth: filtramos también por
  // workspaceId aunque el padre `imports` ya está validado.
  const items = await db
    .select({ targetId: importItems.targetId, kind: importItems.kind })
    .from(importItems)
    .where(
      and(
        eq(importItems.importId, opts.importId),
        eq(importItems.workspaceId, opts.workspaceId),
        eq(importItems.status, "imported"),
        eq(importItems.kind, "entry"),
      ),
    );
  const entryIds = items
    .map((i) => i.targetId)
    .filter((id): id is string => typeof id === "string");

  let deleted = 0;
  if (entryIds.length > 0) {
    deleted = await deleteReturningCount(
      entries,
      and(eq(entries.workspaceId, opts.workspaceId), inArray(entries.id, entryIds))!,
    );
  }

  await db
    .update(importItems)
    .set({ status: "reverted" })
    .where(eq(importItems.importId, opts.importId));

  await db
    .update(imports)
    .set({ status: "reverted", revertedAt: new Date() })
    .where(eq(imports.id, opts.importId));

  await logActivity({
    workspaceId: opts.workspaceId,
    actorId: opts.userId,
    action: "import.reverted",
    targetType: "import",
    targetId: opts.importId,
    meta: { deleted },
  });

  return { deleted };
}

/**
 * Suma stats sql por importId — útil para dashboard.
 */
export async function importStatsByLot(workspaceId: string, importId: string) {
  if (!db) return null;
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      imported: sql<number>`sum(case when ${importItems.status} = 'imported' then 1 else 0 end)::int`,
      failed: sql<number>`sum(case when ${importItems.status} = 'failed' then 1 else 0 end)::int`,
      reverted: sql<number>`sum(case when ${importItems.status} = 'reverted' then 1 else 0 end)::int`,
    })
    .from(importItems)
    .where(and(eq(importItems.workspaceId, workspaceId), eq(importItems.importId, importId)));
  return row ?? null;
}
