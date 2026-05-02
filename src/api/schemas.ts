/**
 * Zod schemas reutilizables del REST API.
 *
 * Estos schemas se usan para:
 *   - Validar requests entrantes
 *   - Documentar respuestas en OpenAPI
 *   - Tipar handlers
 */

import { z } from "zod";

// ============================================================
// Common
// ============================================================

export const UuidSchema = z.string().uuid();
export const SlugSchema = z.string().min(1).max(160);
export const LocaleSchema = z.string().min(2).max(10).default("es");

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(200)),
  sort: z.string().optional(),
  fields: z.string().optional(),
});

export const PageMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  count: z.number().int(),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: PageMetaSchema,
  });
}

// ============================================================
// Resources
// ============================================================

export const EntryResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]),
  locale: z.string(),
  collection: z.object({ id: z.string(), slug: z.string(), name: z.string() }).optional(),
  body: z.unknown().optional(),
  bodyText: z.string().nullable().optional(),
  fields: z.record(z.unknown()).nullable().optional(),
  authorId: z.string().nullable().optional(),
  publishedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      ogImage: z.string().optional(),
    })
    .nullable()
    .optional(),
  ogImageUrl: z.string().nullable().optional(),
});

export const EntryCreateSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().max(160).optional(),
  collectionSlug: z.string().min(1).default("posts"),
  locale: LocaleSchema.optional(),
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]).default("draft"),
  body: z.unknown().optional(),
  excerpt: z.string().max(500).optional(),
  fields: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      ogImage: z.string().optional(),
    })
    .optional(),
});

export const EntryUpdateSchema = EntryCreateSchema.partial();

export const CollectionResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  isSingleton: z.boolean(),
  isBuiltin: z.boolean(),
  schema: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MediaResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  filename: z.string().nullable(),
  mime: z.string(),
  size: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  alt: z.string().nullable(),
  caption: z.string().nullable(),
  blurhash: z.string().nullable(),
  dominantColor: z.string().nullable(),
  focalX: z.number().nullable(),
  focalY: z.number().nullable(),
  aiTags: z.array(z.string()).nullable(),
  tagsManual: z.array(z.string()).nullable(),
  variants: z.unknown().nullable(),
  createdAt: z.string(),
});

export const PageResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  locale: z.string(),
  isHome: z.boolean(),
  layout: z.unknown().nullable(),
  seo: z.unknown().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CommentResourceSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  parentId: z.string().nullable(),
  authorName: z.string(),
  authorEmail: z.string(),
  body: z.string(),
  status: z.enum(["pending", "approved", "spam"]),
  aiScore: z.number().nullable(),
  createdAt: z.string(),
});

export const TaxonomyResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(["category", "tag"]),
  terms: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        parentId: z.string().nullable(),
      }),
    )
    .optional(),
});

export const MeResponseSchema = z.object({
  apiKey: z.object({
    id: z.string(),
    workspaceId: z.string(),
    environment: z.enum(["live", "test"]),
    scopes: z.array(z.string()),
    rateLimit: z.number(),
  }),
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
});

export const EmptyResponseSchema = z.object({ ok: z.literal(true) });
