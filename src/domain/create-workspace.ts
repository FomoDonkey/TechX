/**
 * F11d — Crear un workspace nuevo desde la UI con setup mínimo.
 *
 * Diferencia con `src/app/onboarding/_actions.ts` (que es full-blown con
 * brand IA + categorías + posts demo): aquí queremos el camino directo
 * desde el switcher de workspaces, sin wizard. Crea workspace + colecciones
 * builtin (posts/pages) + membership owner. El user puede empezar a escribir
 * inmediatamente.
 *
 * Reglas:
 *  - Validamos slug con `validateSlug()` — mismas reglas que el rename.
 *  - Reintentamos hasta 8 veces si el slug colisiona (race + sufijo `-2`,
 *    `-3`, …) usando `withSuffix()` del slugify utility ya existente.
 *  - Atomic: todo en una transacción. Si una colección falla, no queda
 *    workspace huérfano.
 */

import { db } from "@/db/client";
import { collections, members, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { withSuffix } from "@/lib/slug";
import { WS_COOKIE } from "@/lib/workspace";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { checkSlugAvailability } from "./rename";
import { validateSlug } from "./slug";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === UNIQUE_VIOLATION || e.cause?.code === UNIQUE_VIOLATION;
}

export type CreateWorkspaceInput = {
  name: string;
  slug: string;
  /** Si lo pasa el caller, copia el branding inicial. Útil para "Duplicar este sitio". */
  branding?: {
    logo?: string;
    voice?: string;
    colors?: { primary?: string; accent?: string };
    font?: string;
  };
  ownerId: string;
};

export type CreateWorkspaceResult =
  | { ok: true; workspace: { id: string; slug: string; name: string } }
  | { ok: false; reason: CreateWorkspaceError; message: string };

export type CreateWorkspaceError =
  | "invalid_name"
  | "invalid_slug"
  | "reserved_slug"
  | "slug_taken"
  | "db_disabled"
  | "internal";

export async function createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult> {
  if (!db) return { ok: false, reason: "db_disabled", message: "Base de datos no disponible" };

  const name = input.name.trim();
  if (!name || name.length < 2 || name.length > 60) {
    return { ok: false, reason: "invalid_name", message: "Nombre entre 2 y 60 caracteres." };
  }

  const v = validateSlug(input.slug);
  if (!v.ok) {
    if (v.error === "reserved") {
      return {
        ok: false,
        reason: "reserved_slug",
        message: "Ese identificador está reservado.",
      };
    }
    return {
      ok: false,
      reason: "invalid_slug",
      message: "Identificador inválido. Usa solo letras minúsculas, números y guiones (3-30 char).",
    };
  }

  const baseSlug = v.slug;

  // Reintenta hasta 8 veces ante race en slug; cada intento es atómico.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : suffixCapped(baseSlug, attempt + 1);

    // Pre-check para evitar spam de inserts si el slug está claramente tomado.
    // No es estrictamente necesario (la transacción maneja unique violation),
    // pero nos ahorra ruido en logs y un round-trip cuando el slug obvio
    // está tomado (los workspaces casi siempre se crean con un slug nuevo).
    if (attempt === 0) {
      // checkSlugAvailability requiere callerWorkspaceId; usamos un UUID-cero
      // para que NUNCA matchee como "self" → trata todo como "taken".
      const avail = await checkSlugAvailability(candidate, "00000000-0000-0000-0000-000000000000");
      if (!avail.ok && avail.reason !== "db_disabled") {
        if (avail.reason === "reserved") {
          return {
            ok: false,
            reason: "reserved_slug",
            message: "Ese identificador está reservado.",
          };
        }
        // taken → saltamos al sufijo (no intentamos INSERT que sabemos fallará)
        continue;
      }
    }

    try {
      const created = await db.transaction(async (tx) => {
        const wsId = crypto.randomUUID();
        const postsCollId = crypto.randomUUID();
        const pagesCollId = crypto.randomUUID();

        await tx.insert(workspaces).values({
          id: wsId,
          slug: candidate,
          name,
          branding: input.branding ?? null,
          defaultLocale: "es",
          locales: ["es"],
        });

        await tx.insert(members).values({
          workspaceId: wsId,
          userId: input.ownerId,
          role: "owner",
        });

        await tx.insert(collections).values([
          {
            id: postsCollId,
            workspaceId: wsId,
            name: "Posts",
            slug: "posts",
            icon: "newspaper",
            isBuiltin: true,
            description: "Entradas del blog",
          },
          {
            id: pagesCollId,
            workspaceId: wsId,
            name: "Páginas",
            slug: "pages",
            icon: "file-text",
            isBuiltin: true,
            description: "Páginas estáticas",
          },
        ]);

        const [ws] = await tx.select().from(workspaces).where(eq(workspaces.id, wsId)).limit(1);
        if (!ws) throw new Error("workspace_not_inserted");
        return ws;
      });

      await logActivity({
        workspaceId: created.id,
        actorId: input.ownerId,
        action: "workspace.created",
        targetType: "workspace",
        targetId: created.id,
        meta: { source: "ui_new_site", slug: created.slug, name: created.name },
      });

      // Switch al workspace recién creado para que la UI lo refleje.
      const c = await cookies();
      c.set(WS_COOKIE, created.slug, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });

      return {
        ok: true,
        workspace: { id: created.id, slug: created.slug, name: created.name },
      };
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      // Log sanitizado: solo el mensaje, no el objeto completo (que puede
      // incluir SQL params, stack traces con paths, etc.).
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[createWorkspace] failed: ${msg}`);
      return {
        ok: false,
        reason: "internal",
        message: "Error al crear el sitio. Inténtalo de nuevo.",
      };
    }
  }

  return {
    ok: false,
    reason: "slug_taken",
    message:
      "No conseguimos un identificador libre tras varios intentos. Prueba con un nombre distinto.",
  };
}

/**
 * Wrapper de `withSuffix` que respeta el límite de 30 chars de
 * `validateSlug()`. Si la base es muy larga, la trunca antes de sufijar.
 * Asegura que el resultado siempre sea válido para path-based routing.
 */
function suffixCapped(baseSlug: string, n: number): string {
  const suffix = `-${n}`;
  const maxBase = 30 - suffix.length;
  const truncated = baseSlug.length > maxBase ? baseSlug.slice(0, maxBase) : baseSlug;
  // Quitar guión final si la truncación lo dejó al borde.
  const clean = truncated.replace(/-+$/, "");
  return withSuffix(clean, n);
}
