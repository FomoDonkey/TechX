"use server";

import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { collections, entries, members, taxonomies, terms, users, workspaces } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { isValidSlug, slugify, withSuffix } from "@/lib/slug";
import { WS_COOKIE } from "@/lib/workspace";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const SiteInput = z.object({
  prompt: z.string().min(2).max(500),
  brand: z.object({
    name: z.string().min(2).max(60),
    slug: z.string().min(2).max(48),
    tagline: z.string().min(2).max(200),
    emoji: z.string().min(1).max(8),
    voice: z.string().optional(),
    font: z.enum(["geist", "lora", "jetbrains"]),
    palette: z.object({
      primary: z.string(),
      accent: z.string(),
      success: z.string().optional(),
      background: z.string().optional(),
      foreground: z.string().optional(),
    }),
  }),
  categories: z.array(z.object({ name: z.string(), slug: z.string(), emoji: z.string() })).max(10),
  posts: z
    .array(
      z.object({
        title: z.string(),
        slug: z.string(),
        excerpt: z.string(),
        category: z.string(),
        bodyMarkdown: z.string(),
      }),
    )
    .max(10),
});

export type SiteInput = z.infer<typeof SiteInput>;

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === UNIQUE_VIOLATION || e.cause?.code === UNIQUE_VIOLATION;
}

/**
 * Convierte markdown plano (separado por líneas en blanco) en Tiptap JSON.
 * Suficiente para los posts demo del onboarding — el editor los abre como
 * párrafos editables. Soporte completo de markdown llega en el importer (Fase 9).
 */
function markdownToTiptapDoc(md: string): unknown {
  const blocks = md
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: blocks.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

export async function createSiteFromOnboarding(raw: unknown) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!db) throw new Error("DB no configurada — define DATABASE_URL en .env");

  const parsed = SiteInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  const baseSlug = isValidSlug(input.brand.slug)
    ? input.brand.slug
    : slugify(input.brand.name) || `csm-${Date.now()}`;

  // Reintenta hasta 8 veces ante race en slug; cada intento es atómico vía transacción.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : withSuffix(baseSlug, attempt + 1);
    try {
      const created = await db.transaction(async (tx) => {
        // IDs app-side para compatibilidad con MySQL (no soporta RETURNING).
        const wsId = crypto.randomUUID();
        const postsCollId = crypto.randomUUID();
        const pagesCollId = crypto.randomUUID();
        const taxId = crypto.randomUUID();

        await tx.insert(workspaces).values({
          id: wsId,
          slug: candidate,
          name: input.brand.name,
          branding: {
            colors: { primary: input.brand.palette.primary, accent: input.brand.palette.accent },
            font: input.brand.font,
            voice: input.brand.voice ?? "cercano",
          },
          defaultLocale: "es",
          locales: ["es"],
        });
        const [ws] = await tx.select().from(workspaces).where(eq(workspaces.id, wsId)).limit(1);
        if (!ws) throw new Error("No se pudo crear el workspace");

        await tx.insert(members).values({
          workspaceId: ws.id,
          userId: user.id,
          role: "owner",
        });

        await tx.insert(collections).values([
          {
            id: postsCollId,
            workspaceId: ws.id,
            name: "Posts",
            slug: "posts",
            icon: "newspaper",
            isBuiltin: true,
            description: "Entradas del blog",
          },
          {
            id: pagesCollId,
            workspaceId: ws.id,
            name: "Páginas",
            slug: "pages",
            icon: "file-text",
            isBuiltin: true,
            description: "Páginas estáticas",
          },
        ]);
        const [postsCollection] = await tx
          .select()
          .from(collections)
          .where(eq(collections.id, postsCollId))
          .limit(1);
        if (!postsCollection) throw new Error("No se pudo crear la colección");

        await tx.insert(taxonomies).values({
          id: taxId,
          workspaceId: ws.id,
          name: "Categorías",
          slug: "categorias",
          type: "category",
        });
        const [taxonomy] = await tx
          .select()
          .from(taxonomies)
          .where(eq(taxonomies.id, taxId))
          .limit(1);

        if (taxonomy && input.categories.length > 0) {
          await tx.insert(terms).values(
            input.categories.map((c) => ({
              taxonomyId: taxonomy.id,
              name: c.name,
              slug: c.slug,
            })),
          );
        }

        if (input.posts.length > 0) {
          await tx.insert(entries).values(
            input.posts.map((p) => ({
              workspaceId: ws.id,
              collectionId: postsCollection.id,
              title: p.title,
              slug: p.slug,
              excerpt: p.excerpt,
              body: markdownToTiptapDoc(p.bodyMarkdown) as never,
              bodyText: p.bodyMarkdown,
              status: "draft" as const,
              locale: "es",
              authorId: user.id,
            })),
          );
        }

        await tx.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));

        return ws;
      });

      // Side effects fuera de la transacción (no críticos)
      await logActivity({
        workspaceId: created.id,
        actorId: user.id,
        action: "workspace.created",
        targetType: "workspace",
        targetId: created.id,
        meta: { prompt: input.prompt, slug: created.slug },
      });

      const c = await cookies();
      c.set(WS_COOKIE, created.slug, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });

      return { ok: true as const, slug: created.slug };
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }

  return {
    ok: false as const,
    error: { brand: ["No se pudo encontrar un slug disponible. Prueba con otro nombre."] },
  };
}
