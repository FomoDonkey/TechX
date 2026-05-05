import { csvParser } from "./sources/csv";
import { ghostParser } from "./sources/ghost";
import { markdownParser } from "./sources/markdown";
import { notionParser } from "./sources/notion";
import { rssParser } from "./sources/rss";
import { wordpressParser } from "./sources/wordpress";
import type { ImportSource, Parser } from "./types";

export const PARSERS: Record<ImportSource, Parser> = {
  wordpress: wordpressParser,
  notion: notionParser,
  markdown: markdownParser,
  ghost: ghostParser,
  rss: rssParser,
  csv: csvParser,
};

/**
 * Auto-detecta source examinando nombre + primeros bytes. Orden importa:
 * los más específicos primero (WordPress XML antes que RSS genérico).
 */
const DETECT_ORDER: ImportSource[] = ["wordpress", "rss", "ghost", "notion", "markdown", "csv"];

export async function detectSource(file: {
  name: string;
  mime: string;
  head?: Buffer;
}): Promise<ImportSource | null> {
  for (const source of DETECT_ORDER) {
    const parser = PARSERS[source];
    if (await parser.detect(file)) return source;
  }
  return null;
}

export function getParser(source: ImportSource): Parser {
  return PARSERS[source];
}

export const SOURCE_LABELS: Record<ImportSource, string> = {
  wordpress: "WordPress",
  notion: "Notion",
  markdown: "Markdown",
  ghost: "Ghost",
  rss: "RSS / Atom",
  csv: "CSV / TSV",
};

export const SOURCE_HINTS: Record<ImportSource, string> = {
  wordpress: "Sube el archivo .xml o .wxr (Tools → Export → All content)",
  notion: "Exporta como Markdown & CSV; sube el .zip resultante",
  markdown: "Un .md suelto o un .zip con varios .md (frontmatter YAML)",
  ghost: "Settings → Labs → Export → archivo .json",
  rss: "URL del feed o el .xml descargado",
  csv: "CSV con encabezados; columnas se mapean en el siguiente paso",
};
