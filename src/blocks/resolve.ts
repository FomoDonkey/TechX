import {
  type BlockNode,
  type RenderContext,
  type ResolvedMedia,
  flattenLayout,
  normalizeLayout,
} from "@/blocks/types";
import { db } from "@/db/client";
import { type Symbol as SymbolRow, media, symbols } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type { RenderContext } from "@/blocks/types";

/** IDs detectados en un layout que apuntan a media o símbolos */
type ResolvedRefs = {
  mediaIds: Set<string>;
  symbolIds: Set<string>;
};

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export function collectRefs(layout: BlockNode[]): ResolvedRefs {
  const out: ResolvedRefs = { mediaIds: new Set(), symbolIds: new Set() };
  for (const node of flattenLayout(layout)) {
    const props = node.props;
    // image/gallery/hero/cta/section.backgroundImage/avatars
    for (const key of Object.keys(props)) {
      const v = props[key];
      if (typeof v === "string" && isUuid(v)) out.mediaIds.add(v);
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === "object") {
            for (const k2 of Object.keys(item)) {
              const v2 = (item as Record<string, unknown>)[k2];
              if (typeof v2 === "string" && isUuid(v2)) out.mediaIds.add(v2);
            }
          }
        }
      }
    }
    if (node.kind === "symbol") {
      const sid = props.symbolId;
      if (typeof sid === "string" && isUuid(sid)) out.symbolIds.add(sid);
    }
  }
  return out;
}

/**
 * Resuelve todas las referencias (media, symbols) de un layout en una sola llamada.
 * Llamado desde la ruta server antes de renderizar.
 */
export async function resolveLayout(
  workspaceId: string,
  layout: BlockNode[],
  options: { followSymbols?: boolean } = {},
): Promise<RenderContext> {
  const refs = collectRefs(layout);
  const mediaMap = new Map<string, ResolvedMedia>();
  const symbolMap = new Map<string, { id: string; name: string; layout: BlockNode[] }>();

  if (!db) return { workspaceId, mediaMap, symbolMap };

  // Resolver símbolos primero (puede que tengan media propia y/o referencias a otros símbolos).
  // Recorrido por niveles con cap (máx 4) para evitar ciclos infinitos.
  if (options.followSymbols !== false && refs.symbolIds.size > 0) {
    let pending = new Set(refs.symbolIds);
    let depth = 0;
    while (pending.size > 0 && depth < 4) {
      const toFetch = Array.from(pending).filter((id) => !symbolMap.has(id));
      pending = new Set();
      if (toFetch.length === 0) break;
      const symbolRows: SymbolRow[] = await db
        .select()
        .from(symbols)
        .where(and(eq(symbols.workspaceId, workspaceId), inArray(symbols.id, toFetch)));
      for (const s of symbolRows) {
        const sLayout = normalizeLayout(s.layout);
        symbolMap.set(s.id, { id: s.id, name: s.name, layout: sLayout });
        const subRefs = collectRefs(sLayout);
        for (const id of subRefs.mediaIds) refs.mediaIds.add(id);
        // Cualquier símbolo nuevo descubierto se enkola para el próximo nivel
        for (const id of subRefs.symbolIds) {
          if (!symbolMap.has(id)) pending.add(id);
        }
      }
      depth += 1;
    }
  }

  if (refs.mediaIds.size > 0) {
    const rows = await db
      .select({
        id: media.id,
        url: media.url,
        alt: media.alt,
        width: media.width,
        height: media.height,
        blurhash: media.blurhash,
        focalX: media.focalX,
        focalY: media.focalY,
        mime: media.mime,
      })
      .from(media)
      .where(and(eq(media.workspaceId, workspaceId), inArray(media.id, Array.from(refs.mediaIds))));
    for (const m of rows) mediaMap.set(m.id, m);
  }
  return { workspaceId, mediaMap, symbolMap };
}
