/**
 * Tipos compartidos del subsistema de imports (F9a).
 *
 * Modelo: cada parser produce un AsyncIterable<RawItem>. El engine consume
 * el stream, normaliza con el `mapping`, persiste en CSM y registra el
 * outcome en `import_items` (idempotente vía sourceId/originRef).
 */

export type ImportSource = "wordpress" | "notion" | "markdown" | "ghost" | "rss" | "csv";

export type RawEntry = {
  kind: "entry";
  /** Id del sistema de origen (post_id, slug, guid, row index…). Usado para idempotencia. */
  sourceId: string;
  /** URL pública original (cuando aplica). Usada para crear redirect auto post-import. */
  sourceUrl?: string;
  title: string;
  slug?: string;
  /** Cuerpo principal en HTML o Markdown según `contentFormat`. */
  content?: string;
  contentFormat?: "html" | "markdown" | "json";
  excerpt?: string;
  status?: "draft" | "published";
  publishedAt?: Date;
  author?: { name?: string; email?: string };
  tags?: string[];
  categories?: string[];
  /** URL absoluta de cover (descarga + sube si mediaPolicy=download, linkea si =link). */
  coverUrl?: string;
  /** Campos arbitrarios extra (custom fields WP, properties Notion, etc.). */
  fields?: Record<string, unknown>;
};

export type RawTerm = {
  kind: "term";
  sourceId: string;
  name: string;
  slug?: string;
  taxonomy: "category" | "tag";
};

export type RawMedia = {
  kind: "media";
  sourceId: string;
  url: string;
  filename?: string;
  alt?: string;
  mime?: string;
};

export type RawComment = {
  kind: "comment";
  sourceId: string;
  entrySourceId: string;
  author: string;
  email?: string;
  body: string;
  createdAt?: Date;
  status?: "approved" | "pending" | "spam";
};

export type RawItem = RawEntry | RawTerm | RawMedia | RawComment;

export type FieldSpec = {
  key: string;
  label: string;
  example?: string;
};

export type MappingTarget =
  | "title"
  | "slug"
  | "body"
  | "excerpt"
  | "publishedAt"
  | "status"
  | "tags"
  | "categories"
  | "cover"
  | "author"
  | "skip";

export type DescribeResult = {
  /** Campos detectados en el archivo. */
  fields: FieldSpec[];
  /** Mapping sugerido (heurística por nombre/contenido). */
  suggested: Record<string, MappingTarget>;
  /** Nº items detectados. */
  totalItems: number;
  /** Hasta 3 entries de muestra para preview en el wizard. */
  sample: Array<Partial<RawEntry>>;
};

export type ParseOptions = {
  /** Si true, el parser puede saltarse trabajo costoso (zips, fetch metadata…). */
  dryRun?: boolean;
  /** Si está, el parser corta tras N entries (preview). */
  limit?: number;
};

export type Parser = {
  source: ImportSource;
  /** Detecta si el archivo es de este source por nombre/mime/contenido. */
  detect(file: { name: string; mime: string; head?: Buffer }): Promise<boolean>;
  /** Streaming: recorre todos los items sin cargar 100% en RAM cuando es posible. */
  parse(buf: Buffer, opts?: ParseOptions): AsyncIterable<RawItem>;
  /** Devuelve descripción de campos + mapping sugerido + sample. */
  describe(buf: Buffer): Promise<DescribeResult>;
};

/**
 * Mapping persistido en `imports.mapping`. Lo construye el wizard en el paso 2.
 *
 * - `collectionId`: dónde aterrizan las entries
 * - `defaultLocale`: locale para entries sin lang explícita
 * - `defaultStatus`: si la entry no trae status, qué usar (`draft` por defecto)
 * - `fields`: source-key → MappingTarget. Las claves coinciden con
 *   `RawEntry.fields[key]` o atributos directos (`title`, `content`...)
 * - `createRedirects`: si true, post-import crea redirect 301 sourceUrl → /collection/slug
 * - `autoCreateTerms`: si true, crea categories/tags faltantes; si false, los omite
 */
export type ImportMapping = {
  collectionId: string;
  defaultLocale?: string;
  defaultStatus?: "draft" | "published";
  fields?: Record<string, MappingTarget>;
  createRedirects?: boolean;
  autoCreateTerms?: boolean;
};

export type ImportProgressEvent =
  | { type: "phase"; phase: "parsing" | "running" | "media" | "redirects" | "done" }
  | { type: "stats"; stats: ImportStats }
  | { type: "item"; status: "imported" | "skipped" | "failed"; kind: string; title?: string }
  | { type: "error"; message: string }
  | { type: "complete"; stats: ImportStats };

export type ImportStats = {
  detected: number;
  planned: number;
  imported: number;
  skipped: number;
  errored: number;
  mediaPlanned: number;
  mediaImported: number;
};

export const EMPTY_STATS: ImportStats = {
  detected: 0,
  planned: 0,
  imported: 0,
  skipped: 0,
  errored: 0,
  mediaPlanned: 0,
  mediaImported: 0,
};
