import { listBranchesWithStats } from "@/branches/lib";
import { db } from "@/db/client";
import { branches, collections, entries, media, taxonomies, workspaces } from "@/db/schema";
import {
  ISSUE_TYPE_LABEL,
  getWorkspaceHealthSummary,
  listEntriesByHealth,
  listEntryIssues,
  scanEntry,
} from "@/health";
import { logActivity } from "@/lib/activity";
import { listCollections } from "@/lib/collections";
import { POSTS_SLUG, createEntry, getEntryById, listEntries } from "@/lib/entries";
import { listSubscribers } from "@/newsletter/subscribers";
import { iLike as ilike } from "@/db/dialect";
import { hybridSearch } from "@/search";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, asc, count, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { resolveMcpActor } from "./actor";
import { type McpSession, ensureScope } from "./auth";

/**
 * Builder helper para devolver respuestas MCP.
 * El SDK acepta `content: [{ type: "text", text: string }]`.
 */
function ok<T>(data: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function fail(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
  };
}

/**
 * Tipo del callback que registerTool espera. Lo escribimos genérico para
 * poder declarar todos los tools como factories puros y luego conectarlos
 * al `McpServer` desde `server.ts`.
 */
export type McpTool = {
  name: string;
  config: {
    title: string;
    description: string;
    inputSchema?: z.ZodRawShape;
    annotations?: {
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
  };
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
};

// ============================================================
// Tools — entries
// ============================================================

function entryListTool(session: McpSession): McpTool {
  return {
    name: "entry_list",
    config: {
      title: "Listar entradas",
      description:
        "Lista entradas de una colección del workspace. Filtros: status, locale, q (búsqueda fuzzy en title/body), limit, offset. Por defecto colección `posts`.",
      inputSchema: {
        collection: z.string().optional().describe("Slug de la colección (default: posts)"),
        status: z
          .enum(["draft", "review", "approved", "scheduled", "published", "archived", "all"])
          .optional()
          .describe("Filtrar por estado"),
        q: z.string().optional().describe("Búsqueda en título y cuerpo"),
        limit: z.number().int().min(1).max(200).optional().describe("Default 50"),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:read", "entries:any"]);
      const result = await listEntries({
        workspaceId: session.workspaceId,
        collectionSlug: (args.collection as string | undefined) ?? POSTS_SLUG,
        status: args.status as Parameters<typeof listEntries>[0]["status"],
        q: args.q as string | undefined,
        limit: (args.limit as number | undefined) ?? 50,
        offset: (args.offset as number | undefined) ?? 0,
      });
      return ok({
        total: result.total,
        counts: result.counts,
        entries: result.rows.map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          status: r.status,
          locale: r.locale,
          excerpt: r.excerpt,
          publishedAt: r.publishedAt?.toISOString() ?? null,
          scheduledAt: r.scheduledAt?.toISOString() ?? null,
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    },
  };
}

function entryGetTool(session: McpSession): McpTool {
  return {
    name: "entry_get",
    config: {
      title: "Leer una entrada",
      description: "Devuelve una entrada completa por id (UUID) o por slug+collection.",
      inputSchema: {
        id: z.string().optional().describe("UUID de la entrada"),
        slug: z.string().optional(),
        collection: z.string().optional().describe("Requerido si usas slug"),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:read", "entries:any"]);
      if (!db) return fail("db_unavailable");
      let entry = null;
      if (args.id) {
        entry = await getEntryById(session.workspaceId, args.id as string);
      } else if (args.slug) {
        const slug = args.slug as string;
        const collSlug = (args.collection as string | undefined) ?? POSTS_SLUG;
        const [coll] = await db
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(eq(collections.workspaceId, session.workspaceId), eq(collections.slug, collSlug)),
          )
          .limit(1);
        if (!coll) return fail(`collection_not_found: ${collSlug}`);
        const [row] = await db
          .select()
          .from(entries)
          .where(
            and(
              eq(entries.workspaceId, session.workspaceId),
              eq(entries.collectionId, coll.id),
              eq(entries.slug, slug),
              isNull(entries.branchId),
            ),
          )
          .limit(1);
        entry = row ?? null;
      } else {
        return fail("Indica `id` o `slug`+`collection`.");
      }
      if (!entry) return fail("entry_not_found");
      return ok({
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        status: entry.status,
        locale: entry.locale,
        excerpt: entry.excerpt,
        body: entry.body,
        bodyText: entry.bodyText,
        seo: entry.seo,
        publishedAt: entry.publishedAt?.toISOString() ?? null,
        scheduledAt: entry.scheduledAt?.toISOString() ?? null,
        updatedAt: entry.updatedAt.toISOString(),
      });
    },
  };
}

function entryCreateTool(session: McpSession): McpTool {
  return {
    name: "entry_create",
    config: {
      title: "Crear entrada (draft)",
      description:
        "Crea un draft en la colección indicada. Devuelve la entry creada. Para añadir contenido al cuerpo, usa `entry_update` con `bodyMarkdown` después.",
      inputSchema: {
        title: z.string().min(1).max(200),
        collection: z.string().optional().describe("Slug colección, default `posts`"),
        locale: z.string().min(2).max(10).optional().describe("Default `es`"),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:write", "entries:any"]);
      if (!db) return fail("db_unavailable");
      const collSlug = (args.collection as string | undefined) ?? POSTS_SLUG;
      const [coll] = await db
        .select({ id: collections.id })
        .from(collections)
        .where(
          and(eq(collections.workspaceId, session.workspaceId), eq(collections.slug, collSlug)),
        )
        .limit(1);
      if (!coll) return fail(`collection_not_found: ${collSlug}`);

      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      const created = await createEntry({
        workspaceId: session.workspaceId,
        collectionId: coll.id,
        authorId: actor.id,
        title: args.title as string,
        locale: args.locale as string | undefined,
      });
      return ok({
        id: created.id,
        slug: created.slug,
        status: created.status,
        title: created.title,
        url: `/admin/contenido/${created.id}`,
      });
    },
  };
}

function entryUpdateTool(session: McpSession): McpTool {
  return {
    name: "entry_update",
    config: {
      title: "Actualizar entrada",
      description:
        "Actualiza campos editoriales de un entry. Acepta título, excerpt, slug, status, scheduledAt (ISO), locale, seo (objeto), bodyMarkdown (markdown plano que sustituye el cuerpo).",
      inputSchema: {
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        excerpt: z.string().max(500).optional(),
        slug: z.string().min(1).max(120).optional(),
        status: z
          .enum(["draft", "review", "approved", "scheduled", "published", "archived"])
          .optional(),
        scheduledAt: z.string().datetime().optional().describe("ISO 8601"),
        locale: z.string().min(2).max(10).optional(),
        bodyMarkdown: z
          .string()
          .max(200_000)
          .optional()
          .describe("Markdown plano: sustituye el body. Para edición rica, usa el editor admin."),
        seoTitle: z.string().max(120).optional(),
        seoDescription: z.string().max(320).optional(),
      },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:write", "entries:any"]);
      if (!db) return fail("db_unavailable");
      const id = args.id as string;
      const existing = await getEntryById(session.workspaceId, id);
      if (!existing) return fail("entry_not_found");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof args.title === "string") updates.title = args.title;
      if (typeof args.excerpt === "string") updates.excerpt = args.excerpt;
      if (typeof args.slug === "string") updates.slug = args.slug;
      if (typeof args.status === "string") updates.status = args.status;
      if (typeof args.scheduledAt === "string") updates.scheduledAt = new Date(args.scheduledAt);
      if (typeof args.locale === "string") updates.locale = args.locale;
      if (typeof args.bodyMarkdown === "string") {
        const md = args.bodyMarkdown as string;
        updates.body = markdownToTiptapDoc(md);
        updates.bodyText = md;
      }
      if (typeof args.seoTitle === "string" || typeof args.seoDescription === "string") {
        const seo = (existing.seo ?? {}) as Record<string, unknown>;
        if (typeof args.seoTitle === "string") seo.title = args.seoTitle;
        if (typeof args.seoDescription === "string") seo.description = args.seoDescription;
        updates.seo = seo;
      }
      // Status side-effects (publishedAt al pasar a published).
      if (updates.status === "published" && !existing.publishedAt) {
        updates.publishedAt = new Date();
      }

      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      updates.updatedById = actor.id;

      await db
        .update(entries)
        .set(updates)
        .where(and(eq(entries.id, id), eq(entries.workspaceId, session.workspaceId)));

      await logActivity({
        workspaceId: session.workspaceId,
        actorId: actor.id,
        action: "entry.updated",
        targetType: "entry",
        targetId: id,
        meta: { source: "mcp", changed: Object.keys(updates) },
      });

      return ok({ id, updated: Object.keys(updates).filter((k) => k !== "updatedAt") });
    },
  };
}

function entryPublishTool(session: McpSession): McpTool {
  return {
    name: "entry_publish",
    config: {
      title: "Publicar entrada",
      description:
        "Pasa una entrada a `published` y setea `publishedAt = now()` si no estaba previamente publicada. Idempotente: re-publica una ya publicada actualiza la fecha.",
      inputSchema: { id: z.string(), republish: z.boolean().optional() },
      annotations: { idempotentHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:publish", "entries:write", "entries:any"]);
      if (!db) return fail("db_unavailable");
      const id = args.id as string;
      const existing = await getEntryById(session.workspaceId, id);
      if (!existing) return fail("entry_not_found");

      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      const now = new Date();
      await db
        .update(entries)
        .set({
          status: "published",
          publishedAt: existing.publishedAt && !args.republish ? existing.publishedAt : now,
          updatedAt: now,
          updatedById: actor.id,
        })
        .where(and(eq(entries.id, id), eq(entries.workspaceId, session.workspaceId)));

      await logActivity({
        workspaceId: session.workspaceId,
        actorId: actor.id,
        action: "entry.published",
        targetType: "entry",
        targetId: id,
        meta: { source: "mcp" },
      });
      return ok({ id, status: "published", publishedAt: now.toISOString() });
    },
  };
}

function entrySearchTool(session: McpSession): McpTool {
  return {
    name: "entry_search",
    config: {
      title: "Buscar entradas (semántica + FTS)",
      description:
        "Búsqueda híbrida BM25 + vectorial sobre todas las entradas (no forks). Devuelve top-K con score y snippet. Ideal para RAG y `Ask CSM`-style.",
      inputSchema: {
        query: z.string().min(1).max(500),
        scope: z.enum(["all", "published"]).optional().describe("Default `all`"),
        limit: z.number().int().min(1).max(50).optional().describe("Default 10"),
        collection: z.string().optional().describe("Filtrar por slug colección"),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:read", "entries:any"]);
      if (!db) return fail("db_unavailable");
      let collectionId: string | undefined;
      if (args.collection) {
        const [coll] = await db
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.workspaceId, session.workspaceId),
              eq(collections.slug, args.collection as string),
            ),
          )
          .limit(1);
        if (!coll) return fail(`collection_not_found: ${args.collection}`);
        collectionId = coll.id;
      }
      const hits = await hybridSearch({
        workspaceId: session.workspaceId,
        query: args.query as string,
        scope: (args.scope as "all" | "published" | undefined) ?? "all",
        limit: (args.limit as number | undefined) ?? 10,
        collectionId,
      });
      return ok({
        count: hits.length,
        hits: hits.map((h) => ({
          id: h.id,
          title: h.title,
          slug: h.slug,
          excerpt: h.excerpt,
          score: Number(h.score.toFixed(4)),
          ftsRank: Number(h.ftsRank.toFixed(4)),
          vectorScore: Number(h.vectorScore.toFixed(4)),
          publishedAt: h.publishedAt?.toISOString() ?? null,
          authorName: h.authorName,
          snippet: h.snippet,
        })),
      });
    },
  };
}

// ============================================================
// Tools — collections + taxonomies
// ============================================================

function collectionListTool(session: McpSession): McpTool {
  return {
    name: "collection_list",
    config: {
      title: "Listar colecciones",
      description: "Devuelve todas las colecciones del workspace (slug, nombre, schema, conteo).",
      annotations: { readOnlyHint: true },
    },
    handler: async () => {
      ensureScope(session, ["collections:read", "entries:read", "entries:any"]);
      const list = await listCollections(session.workspaceId);
      return ok(list);
    },
  };
}

function taxonomyListTool(session: McpSession): McpTool {
  return {
    name: "taxonomy_list",
    config: {
      title: "Listar taxonomías",
      description: "Lista taxonomías (categorías y tags) del workspace.",
      inputSchema: {
        type: z.enum(["category", "tag"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:read", "entries:any"]);
      if (!db) return fail("db_unavailable");
      const conds = [eq(taxonomies.workspaceId, session.workspaceId)];
      if (args.type) conds.push(eq(taxonomies.type, args.type as "category" | "tag"));
      const rows = await db
        .select({
          id: taxonomies.id,
          name: taxonomies.name,
          slug: taxonomies.slug,
          type: taxonomies.type,
        })
        .from(taxonomies)
        .where(and(...conds))
        .orderBy(asc(taxonomies.name));
      return ok(rows);
    },
  };
}

// ============================================================
// Tools — branches
// ============================================================

function branchListTool(session: McpSession): McpTool {
  return {
    name: "branch_list",
    config: {
      title: "Listar branches",
      description:
        "Devuelve las branches de contenido del workspace con stats (forked/new/deleted/conflicts).",
      annotations: { readOnlyHint: true },
    },
    handler: async () => {
      ensureScope(session, ["branches:read", "entries:read", "entries:any"]);
      const list = await listBranchesWithStats(session.workspaceId);
      return ok(
        list.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          status: b.status,
          isDefault: b.isDefault,
          color: b.color,
          stats: b.stats,
          createdAt: b.createdAt.toISOString(),
        })),
      );
    },
  };
}

// ============================================================
// Tools — media
// ============================================================

function mediaSearchTool(session: McpSession): McpTool {
  return {
    name: "media_search",
    config: {
      title: "Buscar medios",
      description:
        "Busca en la mediateca por nombre, alt o caption. Devuelve top N con URL pública.",
      inputSchema: {
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["media:read", "entries:any"]);
      if (!db) return fail("db_unavailable");
      const q = `%${args.query as string}%`;
      const limit = (args.limit as number | undefined) ?? 20;
      const rows = await db
        .select({
          id: media.id,
          key: media.key,
          alt: media.alt,
          caption: media.caption,
          mime: media.mime,
          width: media.width,
          height: media.height,
        })
        .from(media)
        .where(
          and(
            eq(media.workspaceId, session.workspaceId),
            or(ilike(media.key, q), ilike(media.alt, q), ilike(media.caption, q)),
          ),
        )
        .orderBy(desc(media.createdAt))
        .limit(limit);
      return ok({ count: rows.length, media: rows });
    },
  };
}

// ============================================================
// Tools — subscribers
// ============================================================

function subscriberListTool(session: McpSession): McpTool {
  return {
    name: "subscriber_list",
    config: {
      title: "Listar suscriptores",
      description: "Lista suscriptores de la newsletter. Filtros por status y locale.",
      inputSchema: {
        status: z.enum(["active", "unsubscribed", "bounced"]).optional(),
        locale: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["subscribers:read", "entries:any"]);
      const result = await listSubscribers({
        workspaceId: session.workspaceId,
        status: args.status as "active" | "unsubscribed" | "bounced" | undefined,
        limit: (args.limit as number | undefined) ?? 50,
        offset: 0,
      });
      const localeFilter = args.locale as string | undefined;
      const filteredRows = localeFilter
        ? result.rows.filter((s) => s.locale === localeFilter)
        : result.rows;
      return ok({
        total: result.total,
        subscribers: filteredRows.map((s) => ({
          id: s.id,
          email: s.email,
          name: s.name,
          status: s.status,
          locale: s.locale,
          tags: s.tags,
          createdAt: s.createdAt.toISOString(),
        })),
      });
    },
  };
}

// ============================================================
// Tools — workspace info
// ============================================================

function workspaceInfoTool(session: McpSession): McpTool {
  return {
    name: "workspace_info",
    config: {
      title: "Información del workspace",
      description:
        "Devuelve metadatos del workspace activo (slug, nombre, plan, idiomas, custom domain) + conteos rápidos (entries, drafts, subscribers, branches).",
      annotations: { readOnlyHint: true },
    },
    handler: async () => {
      if (!db) return fail("db_unavailable");
      const [ws] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, session.workspaceId))
        .limit(1);
      if (!ws) return fail("workspace_not_found");

      const [entriesTotalRow, draftsCountRow, publishedCountRow, branchesCountRow] =
        await Promise.all([
          db
            .select({ n: count() })
            .from(entries)
            .where(and(eq(entries.workspaceId, ws.id), isNull(entries.branchId))),
          db
            .select({ n: count() })
            .from(entries)
            .where(
              and(
                eq(entries.workspaceId, ws.id),
                isNull(entries.branchId),
                eq(entries.status, "draft"),
              ),
            ),
          db
            .select({ n: count() })
            .from(entries)
            .where(
              and(
                eq(entries.workspaceId, ws.id),
                isNull(entries.branchId),
                eq(entries.status, "published"),
              ),
            ),
          db.select({ n: count() }).from(branches).where(eq(branches.workspaceId, ws.id)),
        ]);

      return ok({
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        plan: ws.plan,
        defaultLocale: ws.defaultLocale,
        locales: ws.locales,
        customDomain: ws.customDomain,
        stats: {
          entries: entriesTotalRow[0]?.n ?? 0,
          drafts: draftsCountRow[0]?.n ?? 0,
          published: publishedCountRow[0]?.n ?? 0,
          branches: branchesCountRow[0]?.n ?? 0,
        },
        environment: session.environment,
        scopes: session.scopes,
      });
    },
  };
}

// ============================================================
// Tools — content health
// ============================================================

function healthSummaryTool(session: McpSession): McpTool {
  return {
    name: "health_summary",
    config: {
      title: "Resumen de salud del contenido",
      description:
        "Devuelve el score promedio del workspace, contadores por severidad y top entries más problemáticas. Sin argumentos: lo más útil para 'cómo va mi contenido'.",
      inputSchema: {
        worstN: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Top N peor puntuadas. Default 5."),
      },
      annotations: { readOnlyHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:read", "entries:any"]);
      const summary = await getWorkspaceHealthSummary(session.workspaceId);
      const top = await listEntriesByHealth({
        workspaceId: session.workspaceId,
        limit: (args.worstN as number | undefined) ?? 5,
      });
      const byTypeLabeled: Record<string, number> = {};
      for (const [k, v] of Object.entries(summary.issuesByType)) {
        byTypeLabeled[ISSUE_TYPE_LABEL[k as keyof typeof ISSUE_TYPE_LABEL] ?? k] = v;
      }
      return ok({
        avgScore: summary.avgScore,
        totalScanned: summary.totalScanned,
        issuesBySeverity: summary.issuesBySeverity,
        issuesByType: byTypeLabeled,
        worst: top.slice(0, (args.worstN as number | undefined) ?? 5).map((e) => ({
          entryId: e.entryId,
          title: e.title,
          slug: e.slug,
          score: e.score,
          counts: e.counts,
        })),
      });
    },
  };
}

function entryHealthScanTool(session: McpSession): McpTool {
  return {
    name: "entry_health_scan",
    config: {
      title: "Escanear salud de una entrada",
      description:
        "Re-escanea (idempotente) una entry y devuelve el score + lista de issues. Usa esto si el user pregunta '¿qué problemas tiene este post?'.",
      inputSchema: { id: z.string().describe("UUID de la entrada") },
      annotations: { idempotentHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["entries:read", "entries:any"]);
      if (!db) return fail("db_unavailable");
      const id = args.id as string;
      const entry = await getEntryById(session.workspaceId, id);
      if (!entry) return fail("entry_not_found");
      const result = await scanEntry({ entry, force: false });
      const issues = await listEntryIssues({ workspaceId: session.workspaceId, entryId: id });
      return ok({
        entryId: id,
        title: entry.title,
        score: result.score,
        cached: result.cached,
        issues: issues
          .filter((i) => !i.dismissedAt)
          .map((i) => ({
            id: i.id,
            type: i.type,
            label: ISSUE_TYPE_LABEL[i.type] ?? i.type,
            severity: i.severity,
            message: i.message,
            suggestion: i.suggestion,
          })),
      });
    },
  };
}

// ============================================================
// Markdown → Tiptap doc (mínimo viable para entry_update bodyMarkdown)
// ============================================================

/**
 * Conversor minimalista markdown → Tiptap JSON. Cubre headings (#-####),
 * listas (-, 1.), bloques de código (```), citas (>) y párrafos. Para
 * conversión completa el editor admin tiene su propio pipeline; este
 * conversor es para que un agente LLM pueda producir contenido publicable
 * sin tener que conocer el formato Tiptap.
 */
export function markdownToTiptapDoc(md: string): {
  type: "doc";
  content: Array<Record<string, unknown>>;
} {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<Record<string, unknown>> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || null;
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        code.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: [{ type: "text", text: code.join("\n") }],
      });
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({
        type: "heading",
        attrs: { level: Math.min(h[1]?.length ?? 1, 6) },
        content: [{ type: "text", text: (h[2] ?? "").trim() }],
      });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*+]\s+/.test(line)) {
      const items: Array<Record<string, unknown>> = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i] ?? "")) {
        const text = (lines[i] ?? "").replace(/^[-*+]\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        });
        i++;
      }
      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: Array<Record<string, unknown>> = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        const text = (lines[i] ?? "").replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        });
        i++;
      }
      blocks.push({ type: "orderedList", content: items });
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const lines2: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith(">")) {
        lines2.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: lines2.join("\n") }] }],
      });
      continue;
    }

    // Paragraph (acumula líneas hasta vacío)
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,6}\s|[-*+]\s|\d+\.\s|>|```)/.test(lines[i] ?? "")
    ) {
      para.push(lines[i] ?? "");
      i++;
    }
    blocks.push({
      type: "paragraph",
      content: [{ type: "text", text: para.join(" ") }],
    });
  }

  return { type: "doc", content: blocks };
}

// ============================================================
// Registro central
// ============================================================

import { buildPageTools } from "./tools-pages";

export function buildAllTools(session: McpSession): McpTool[] {
  return [
    workspaceInfoTool(session),
    // Entries (blog/contenido)
    entryListTool(session),
    entryGetTool(session),
    entryCreateTool(session),
    entryUpdateTool(session),
    entryPublishTool(session),
    entrySearchTool(session),
    healthSummaryTool(session),
    entryHealthScanTool(session),
    collectionListTool(session),
    taxonomyListTool(session),
    branchListTool(session),
    mediaSearchTool(session),
    subscriberListTool(session),
    // Páginas + plantillas espectaculares (Oleada 1)
    ...buildPageTools(session),
  ];
}
