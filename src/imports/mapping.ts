import type { MappingTarget } from "./types";

const KEY_PATTERNS: Array<{ test: RegExp; target: MappingTarget }> = [
  { test: /^(title|name|headline)$/i, target: "title" },
  { test: /^(slug|permalink|post[_-]?name|url[_-]?path)$/i, target: "slug" },
  {
    test: /^(content|content_html|body|html|markdown|md|description|content:encoded)$/i,
    target: "body",
  },
  { test: /^(excerpt|summary|tldr|description|subtitle)$/i, target: "excerpt" },
  {
    test: /^(published|publishedAt|published_at|date|pubDate|created_time|published_time)$/i,
    target: "publishedAt",
  },
  { test: /^(status|state|publication[_-]?status)$/i, target: "status" },
  { test: /^(tag|tags|hashtags|labels)$/i, target: "tags" },
  { test: /^(category|categories|section|topic)$/i, target: "categories" },
  { test: /^(cover|cover_image|hero|featured[_-]?image|thumbnail|image)$/i, target: "cover" },
  { test: /^(author|creator|by|writer|dc:creator)$/i, target: "author" },
];

/**
 * Heurística: dado el nombre de un campo de origen, intenta sugerir el target
 * de mapping. Devuelve "skip" si no matchea (el wizard lo deja sin asignar).
 */
export function suggestMapping(sourceKey: string): MappingTarget {
  const trimmed = sourceKey.trim();
  for (const { test, target } of KEY_PATTERNS) {
    if (test.test(trimmed)) return target;
  }
  return "skip";
}

/**
 * Construye el mapping sugerido completo para un set de campos detectados.
 * Garantiza que cada target obvio (title, body) esté cubierto por al menos
 * una clave; si dos claves matchean el mismo target, gana la primera por orden.
 */
export function buildSuggestedMapping(keys: string[]): Record<string, MappingTarget> {
  const result: Record<string, MappingTarget> = {};
  const taken = new Set<MappingTarget>();
  // Targets que sólo deben aparecer una vez (single-value)
  const SINGLE: MappingTarget[] = [
    "title",
    "slug",
    "body",
    "excerpt",
    "publishedAt",
    "status",
    "cover",
    "author",
  ];
  for (const key of keys) {
    const target = suggestMapping(key);
    if (target === "skip") {
      result[key] = "skip";
      continue;
    }
    if (SINGLE.includes(target) && taken.has(target)) {
      result[key] = "skip";
      continue;
    }
    result[key] = target;
    taken.add(target);
  }
  return result;
}
