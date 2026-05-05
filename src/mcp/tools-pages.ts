/**
 * MCP tools — Páginas y plantillas espectaculares (Oleada 1).
 *
 * Permite al agente:
 *  - Listar/leer/crear/actualizar/publicar/borrar páginas estáticas
 *    (`/admin/paginas/[id]`)
 *  - Aplicar plantillas espectaculares (asme/jack/michael/mint/nimbus/securify/
 *    magazine/substack) — las que viven en `src/templates/page-templates.ts`.
 *  - Editar bloques individuales del árbol (texto, hero title, perks, etc.)
 *
 * Las page tools se registran junto con las entry tools en `buildAllTools()`.
 * Scopes: `pages:read` para read tools, `pages:write` para create/update/delete/publish.
 *
 * Patrón conservador con safety:
 *  - `page_apply_template` SIEMPRE crea una página draft nueva por defecto
 *    (no machaca una existente). Para sobreescribir, hay que pasar
 *    `mode: "replace"` + `pageId` + confirmar via prompt UX en el agente.
 *  - `page_delete` requiere prefix exact match del título o id como
 *    "confirmation" (anti-borrado-accidental por agente).
 */

import { logActivity } from "@/lib/activity";
import {
  createPage,
  deletePage,
  getPageById,
  listPages,
  updatePage,
} from "@/lib/pages";
import { findNode, removeNode, updateNode } from "@/blocks/types";
import type { BlockNode } from "@/blocks/types";
import { PAGE_TEMPLATES, getPageTemplate } from "@/templates/page-templates";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { resolveMcpActor } from "./actor";
import type { McpTool } from "./tools";
import { type McpSession, ensureScope } from "./auth";

function ok<T>(data: T): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: `Error: ${message}` }] };
}

// ============================================================
// page_list — listar páginas con filtros
// ============================================================
function pageListTool(session: McpSession): McpTool {
  return {
    name: "page_list",
    config: {
      title: "Listar páginas",
      description:
        "Lista las páginas estáticas del workspace (las de `/admin/paginas`). " +
        "Filtros: status (draft/published/archived/all), q (busca en title o path), limit, offset. " +
        "Devuelve metadata de cada página + counts agregados por estado. " +
        "Usa esto antes de crear para verificar qué páginas existen.",
      inputSchema: {
        status: z
          .enum(["draft", "published", "archived", "all"])
          .optional()
          .describe("Default 'all'"),
        q: z.string().optional().describe("Búsqueda en título y path"),
        limit: z.number().int().min(1).max(200).optional().describe("Default 50"),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:read", "pages:any"]);
      const result = await listPages(session.workspaceId, {
        status: args.status as "draft" | "published" | "archived" | "all" | undefined,
        q: args.q as string | undefined,
        limit: (args.limit as number | undefined) ?? 50,
        offset: (args.offset as number | undefined) ?? 0,
      });
      return ok({
        total: result.total,
        counts: result.counts,
        pages: result.rows.map((p) => ({
          id: p.id,
          title: p.title,
          path: p.path,
          locale: p.locale,
          status: p.status,
          isHome: p.isHome,
          publishedAt: p.publishedAt?.toISOString() ?? null,
          updatedAt: p.updatedAt.toISOString(),
        })),
      });
    },
  };
}

// ============================================================
// page_get — lee página completa con su layout (árbol de bloques)
// ============================================================
function pageGetTool(session: McpSession): McpTool {
  return {
    name: "page_get",
    config: {
      title: "Leer página",
      description:
        "Devuelve una página completa: metadata + SEO + árbol de bloques (`layout`). " +
        "El layout es un array de BlockNodes con `kind`, `props`, `children`. " +
        "Para editar bloques específicos, mira `page_update_block`.",
      inputSchema: {
        id: z.string().uuid().describe("UUID de la página"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:read", "pages:any"]);
      const page = await getPageById(session.workspaceId, args.id as string);
      if (!page) return fail(`Página ${args.id} no encontrada`);
      return ok({
        id: page.id,
        title: page.title,
        path: page.path,
        locale: page.locale,
        status: page.status,
        isHome: page.isHome,
        seo: page.seo,
        publishedAt: page.publishedAt?.toISOString() ?? null,
        updatedAt: page.updatedAt.toISOString(),
        layout: page.layout,
      });
    },
  };
}

// ============================================================
// page_create — crear página vacía o con layout custom
// ============================================================
function pageCreateTool(session: McpSession): McpTool {
  return {
    name: "page_create",
    config: {
      title: "Crear página",
      description:
        "Crea una página nueva (status = draft). Si quieres una página espectacular " +
        "basada en una plantilla, usa `page_apply_template` en su lugar. " +
        "Esta tool es para páginas vacías o con layout custom.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Título de la página"),
        path: z
          .string()
          .max(200)
          .optional()
          .describe(
            "Path URL relativo (`/about`, `/precios`). Si vacío, se genera del título. Si choca, se añade sufijo.",
          ),
        locale: z.string().max(10).optional().describe("Default 'es'"),
        layout: z
          .array(z.unknown())
          .optional()
          .describe("Array de BlockNode. Si vacío, página en blanco."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:write", "pages:any"]);
      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      try {
        const page = await createPage({
          workspaceId: session.workspaceId,
          authorId: actor.id,
          title: args.title as string,
          path: args.path as string | undefined,
          locale: args.locale as string | undefined,
          layout: args.layout as unknown,
        });
        await logActivity({
          workspaceId: session.workspaceId,
          actorId: actor.id,
          action: "page.created_via_mcp",
          targetType: "page",
          targetId: page.id,
          meta: { title: page.title, path: page.path, source: "mcp" },
        });
        return ok({
          ok: true,
          page: {
            id: page.id,
            title: page.title,
            path: page.path,
            locale: page.locale,
            status: page.status,
            editorUrl: `/admin/paginas/${page.id}`,
          },
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "create_failed");
      }
    },
  };
}

// ============================================================
// page_apply_template — crear página espectacular desde plantilla
// ============================================================
function pageApplyTemplateTool(session: McpSession): McpTool {
  return {
    name: "page_apply_template",
    config: {
      title: "Aplicar plantilla espectacular",
      description:
        "Crea una página NUEVA basada en una plantilla espectacular " +
        "(saas-magnetic/portfolio-spotlight/agency-spotlight/coming-soon-typewriter/" +
        "docs-aurora/blog-particles/launch-marquee/newsletter-typewriter). " +
        "Inserta los ~6 bloques `tpl-*` editables con copy/imágenes/vídeos por defecto. " +
        "Después usa `page_update_block` para personalizar textos. " +
        "Modo 'replace' (avanzado) machaca el layout de una página existente.",
      inputSchema: {
        templateId: z
          .enum([
            "saas-magnetic",
            "portfolio-spotlight",
            "agency-spotlight",
            "coming-soon-typewriter",
            "docs-aurora",
            "blog-particles",
            "launch-marquee",
            "newsletter-typewriter",
          ])
          .describe("Slug de la plantilla — usa `template_list` para ver opciones."),
        title: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe("Título de la página. Si vacío, usa `suggestedTitle` de la plantilla."),
        path: z
          .string()
          .max(200)
          .optional()
          .describe("Path URL. Si vacío, se genera del título."),
        locale: z.string().max(10).optional(),
        mode: z
          .enum(["create", "replace"])
          .optional()
          .describe("Default 'create'. 'replace' machaca el layout de `pageId`."),
        pageId: z.string().uuid().optional().describe("Required si mode='replace'."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:write", "pages:any"]);
      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      const templateId = args.templateId as string;
      const template = getPageTemplate(templateId);
      if (!template) return fail(`Plantilla "${templateId}" no encontrada`);
      const layout = template.buildLayout();
      const mode = (args.mode as "create" | "replace" | undefined) ?? "create";

      if (mode === "replace") {
        const pageId = args.pageId as string | undefined;
        if (!pageId) return fail("mode='replace' requiere pageId");
        const existing = await getPageById(session.workspaceId, pageId);
        if (!existing) return fail(`Página ${pageId} no encontrada`);
        try {
          const updated = await updatePage({
            workspaceId: session.workspaceId,
            id: pageId,
            userId: actor.id,
            layout,
            ...(args.title ? { title: args.title as string } : {}),
          });
          await logActivity({
            workspaceId: session.workspaceId,
            actorId: actor.id,
            action: "page.template_replaced_via_mcp",
            targetType: "page",
            targetId: updated.id,
            meta: { templateId, source: "mcp" },
          });
          return ok({
            ok: true,
            mode: "replace",
            page: {
              id: updated.id,
              title: updated.title,
              path: updated.path,
              status: updated.status,
              editorUrl: `/admin/paginas/${updated.id}`,
            },
            template: { id: template.id, name: template.name, blockCount: layout.length },
          });
        } catch (e) {
          return fail(e instanceof Error ? e.message : "replace_failed");
        }
      }

      // mode === "create"
      try {
        const finalTitle =
          (args.title as string | undefined)?.trim() || template.suggestedTitle;
        const page = await createPage({
          workspaceId: session.workspaceId,
          authorId: actor.id,
          title: finalTitle,
          path: args.path as string | undefined,
          locale: args.locale as string | undefined,
          layout,
        });
        await logActivity({
          workspaceId: session.workspaceId,
          actorId: actor.id,
          action: "page.created_from_template_via_mcp",
          targetType: "page",
          targetId: page.id,
          meta: { templateId, title: finalTitle, source: "mcp" },
        });
        return ok({
          ok: true,
          mode: "create",
          page: {
            id: page.id,
            title: page.title,
            path: page.path,
            locale: page.locale,
            status: page.status,
            editorUrl: `/admin/paginas/${page.id}`,
            previewUrl: `/template-preview/${templateId}`,
          },
          template: { id: template.id, name: template.name, blockCount: layout.length },
          nextSteps: [
            "Usa `page_get` con el id devuelto para ver los bloques tpl-* insertados.",
            "Usa `page_update_block` para personalizar textos/imágenes de cada bloque.",
            "Cuando esté listo, usa `page_publish`.",
          ],
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "create_failed");
      }
    },
  };
}

// ============================================================
// page_update — actualiza title, path, status, isHome, seo (NO layout)
// ============================================================
function pageUpdateTool(session: McpSession): McpTool {
  return {
    name: "page_update",
    config: {
      title: "Actualizar página (metadata)",
      description:
        "Actualiza metadata de una página (título, path, locale, status, isHome, SEO). " +
        "NO toca el árbol de bloques — para editar bloques usa `page_update_block`. " +
        "Para reemplazar TODO el layout con una plantilla, usa `page_apply_template` con mode='replace'.",
      inputSchema: {
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        path: z.string().max(200).optional(),
        locale: z.string().max(10).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        isHome: z.boolean().optional().describe("Marcar como home (1 por locale)"),
        seo: z
          .object({
            title: z.string().max(120).optional(),
            description: z.string().max(280).optional(),
            ogImage: z.string().url().optional(),
          })
          .nullable()
          .optional(),
      },
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:write", "pages:any"]);
      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      try {
        const updated = await updatePage({
          workspaceId: session.workspaceId,
          id: args.id as string,
          userId: actor.id,
          title: args.title as string | undefined,
          path: args.path as string | undefined,
          locale: args.locale as string | undefined,
          status: args.status as "draft" | "published" | "archived" | undefined,
          isHome: args.isHome as boolean | undefined,
          seo: args.seo as Record<string, string> | null | undefined,
        });
        await logActivity({
          workspaceId: session.workspaceId,
          actorId: actor.id,
          action: "page.updated_via_mcp",
          targetType: "page",
          targetId: updated.id,
          meta: {
            patches: Object.keys(args).filter((k) => k !== "id"),
            source: "mcp",
          },
        });
        return ok({
          ok: true,
          page: {
            id: updated.id,
            title: updated.title,
            path: updated.path,
            status: updated.status,
            isHome: updated.isHome,
          },
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "update_failed");
      }
    },
  };
}

// ============================================================
// page_update_block — actualiza props de un bloque concreto del layout
// ============================================================
function pageUpdateBlockTool(session: McpSession): McpTool {
  return {
    name: "page_update_block",
    config: {
      title: "Editar bloque de una página",
      description:
        "Actualiza las props de un bloque dentro del árbol de la página. " +
        "Útil para personalizar textos/imágenes/vídeos de un bloque tpl-* (ej. cambiar el título del hero). " +
        "Pasa `pageId`, `blockId` (lo obtienes de `page_get`) y un `propsPatch` (objeto parcial). " +
        "El patch se hace MERGE no REPLACE — solo cambia las keys que pasas.",
      inputSchema: {
        pageId: z.string().uuid(),
        blockId: z.string().describe("ID del bloque dentro del layout (campo `id` del BlockNode)"),
        propsPatch: z
          .record(z.unknown())
          .describe("Objeto con las props a cambiar. Ej: { title: 'Nuevo titulo', subtitle: '...' }"),
      },
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:write", "pages:any"]);
      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      const page = await getPageById(session.workspaceId, args.pageId as string);
      if (!page) return fail(`Página ${args.pageId} no encontrada`);
      const layoutArr = (page.layout ?? []) as BlockNode[];
      const node = findNode(layoutArr, args.blockId as string);
      if (!node) return fail(`Bloque ${args.blockId} no encontrado en la página`);

      const patch = args.propsPatch as Record<string, unknown>;
      const newLayout = updateNode(layoutArr, args.blockId as string, (n) => ({
        ...n,
        props: { ...n.props, ...patch },
      }));

      try {
        await updatePage({
          workspaceId: session.workspaceId,
          id: args.pageId as string,
          userId: actor.id,
          layout: newLayout,
        });
        await logActivity({
          workspaceId: session.workspaceId,
          actorId: actor.id,
          action: "page.block_updated_via_mcp",
          targetType: "page",
          targetId: args.pageId as string,
          meta: {
            blockId: args.blockId,
            blockKind: node.kind,
            patchKeys: Object.keys(patch),
            source: "mcp",
          },
        });
        return ok({
          ok: true,
          pageId: args.pageId,
          block: {
            id: node.id,
            kind: node.kind,
            updatedProps: patch,
          },
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "update_block_failed");
      }
    },
  };
}

// ============================================================
// page_remove_block — elimina un bloque del árbol
// ============================================================
function pageRemoveBlockTool(session: McpSession): McpTool {
  return {
    name: "page_remove_block",
    config: {
      title: "Quitar bloque de una página",
      description:
        "Elimina un bloque del árbol de la página por su `blockId`. " +
        "Si el bloque tiene children, se eliminan recursivamente. " +
        "Útil para quitar secciones de una plantilla (ej. eliminar el footer si vas a usar uno custom).",
      inputSchema: {
        pageId: z.string().uuid(),
        blockId: z.string(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:write", "pages:any"]);
      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      const page = await getPageById(session.workspaceId, args.pageId as string);
      if (!page) return fail(`Página ${args.pageId} no encontrada`);
      const layoutArr = (page.layout ?? []) as BlockNode[];
      const node = findNode(layoutArr, args.blockId as string);
      if (!node) return fail(`Bloque ${args.blockId} no encontrado`);

      const newLayout = removeNode(layoutArr, args.blockId as string);
      try {
        await updatePage({
          workspaceId: session.workspaceId,
          id: args.pageId as string,
          userId: actor.id,
          layout: newLayout,
        });
        await logActivity({
          workspaceId: session.workspaceId,
          actorId: actor.id,
          action: "page.block_removed_via_mcp",
          targetType: "page",
          targetId: args.pageId as string,
          meta: { blockId: args.blockId, blockKind: node.kind, source: "mcp" },
        });
        return ok({ ok: true, removed: { id: node.id, kind: node.kind } });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "remove_block_failed");
      }
    },
  };
}

// ============================================================
// page_publish — publica una página (status → published)
// ============================================================
function pagePublishTool(session: McpSession): McpTool {
  return {
    name: "page_publish",
    config: {
      title: "Publicar página",
      description:
        "Cambia el status de una página a 'published'. La página queda accesible en su path " +
        "(ej. `/precios`). Si ya estaba publicada, es no-op. " +
        "Para despublicar, usa `page_update` con status='draft' o 'archived'.",
      inputSchema: {
        id: z.string().uuid(),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:write", "pages:any"]);
      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      try {
        const updated = await updatePage({
          workspaceId: session.workspaceId,
          id: args.id as string,
          userId: actor.id,
          status: "published",
        });
        await logActivity({
          workspaceId: session.workspaceId,
          actorId: actor.id,
          action: "page.published_via_mcp",
          targetType: "page",
          targetId: updated.id,
          meta: { source: "mcp", path: updated.path },
        });
        return ok({
          ok: true,
          page: {
            id: updated.id,
            title: updated.title,
            path: updated.path,
            status: updated.status,
            publishedAt: updated.publishedAt?.toISOString() ?? null,
            url: updated.path,
          },
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "publish_failed");
      }
    },
  };
}

// ============================================================
// page_delete — borra una página (con confirmation guard)
// ============================================================
function pageDeleteTool(session: McpSession): McpTool {
  return {
    name: "page_delete",
    config: {
      title: "Borrar página",
      description:
        "Borra una página permanentemente. REQUIERE `confirm` igual al título exacto " +
        "de la página como guard anti-borrado-accidental por agente. " +
        "Para deshabilitar sin borrar, usa `page_update` con status='archived'.",
      inputSchema: {
        id: z.string().uuid(),
        confirm: z
          .string()
          .describe("Debe ser EXACTAMENTE el título de la página. Anti-accidente."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:write", "pages:any"]);
      const actor = await resolveMcpActor({
        apiKeyId: session.apiKeyId,
        workspaceId: session.workspaceId,
        directActorId: session.directActorId,
      });
      const page = await getPageById(session.workspaceId, args.id as string);
      if (!page) return fail(`Página ${args.id} no encontrada`);
      if ((args.confirm as string) !== page.title) {
        return fail(
          `confirm no matchea. Esperado el título exacto: "${page.title}". Pasaste: "${args.confirm}"`,
        );
      }
      try {
        await deletePage(session.workspaceId, args.id as string);
        await logActivity({
          workspaceId: session.workspaceId,
          actorId: actor.id,
          action: "page.deleted_via_mcp",
          targetType: "page",
          targetId: args.id as string,
          meta: { title: page.title, path: page.path, source: "mcp" },
        });
        return ok({ ok: true, deleted: { id: page.id, title: page.title, path: page.path } });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "delete_failed");
      }
    },
  };
}

// ============================================================
// template_list — catálogo de plantillas espectaculares
// ============================================================
function templateListTool(session: McpSession): McpTool {
  return {
    name: "template_list",
    config: {
      title: "Listar plantillas espectaculares",
      description:
        "Devuelve el catálogo de las 8 plantillas espectaculares disponibles para crear páginas " +
        "(asme/jack/michael/mint/nimbus/securify/magazine/substack). Cada una con descripción, " +
        "categoría (saas/portfolio/blog/newsletter/launch), tags y suggestedTitle. " +
        "Usa esto antes de `page_apply_template` para que el agente recomiende la mejor plantilla.",
      inputSchema: {
        category: z
          .enum(["all", "saas", "portfolio", "blog", "newsletter", "launch"])
          .optional()
          .describe("Default 'all'"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:read", "pages:any"]);
      const filter = (args.category as string | undefined) ?? "all";
      const items = PAGE_TEMPLATES.filter(
        (t) => filter === "all" || t.category === filter,
      ).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        accent: t.accent,
        tags: t.tags,
        suggestedTitle: t.suggestedTitle,
        blockCount: t.buildLayout().length,
        previewUrl: `/template-preview/${t.id}`,
      }));
      return ok({ total: items.length, templates: items });
    },
  };
}

// ============================================================
// template_get — info detallada + preview de bloques
// ============================================================
function templateGetTool(session: McpSession): McpTool {
  return {
    name: "template_get",
    config: {
      title: "Detalle de una plantilla",
      description:
        "Devuelve info detallada de una plantilla espectacular incluyendo el árbol de bloques " +
        "que se insertaría (`layout`). Cada nodo tiene `kind` y `props` con sus defaults. " +
        "Útil para que el agente sepa qué props existe en cada bloque antes de generar `page_update_block`.",
      inputSchema: {
        templateId: z.enum([
          "saas-magnetic",
          "portfolio-spotlight",
          "agency-spotlight",
          "coming-soon-typewriter",
          "docs-aurora",
          "blog-particles",
          "launch-marquee",
          "newsletter-typewriter",
        ]),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler: async (args) => {
      ensureScope(session, ["pages:read", "pages:any"]);
      const t = getPageTemplate(args.templateId as string);
      if (!t) return fail(`Plantilla "${args.templateId}" no encontrada`);
      const layout = t.buildLayout();
      return ok({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        accent: t.accent,
        tags: t.tags,
        suggestedTitle: t.suggestedTitle,
        theme: t.theme,
        blocks: layout.map((b) => ({
          id: b.id,
          kind: b.kind,
          // Limitar props para evitar payloads enormes — el agente puede pedir
          // page_get tras crear para ver props completas.
          propsKeys: Object.keys(b.props ?? {}),
        })),
        previewUrl: `/template-preview/${t.id}`,
      });
    },
  };
}

// ============================================================
// Export — añadido a buildAllTools en tools.ts
// ============================================================
export function buildPageTools(session: McpSession): McpTool[] {
  return [
    pageListTool(session),
    pageGetTool(session),
    pageCreateTool(session),
    pageApplyTemplateTool(session),
    pageUpdateTool(session),
    pageUpdateBlockTool(session),
    pageRemoveBlockTool(session),
    pagePublishTool(session),
    pageDeleteTool(session),
    templateListTool(session),
    templateGetTool(session),
  ];
}
