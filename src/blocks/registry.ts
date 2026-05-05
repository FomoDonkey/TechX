import { SPECTACULAR_SPECS } from "@/blocks/spectacular/specs";
import { type BlockKind, type BlockNode, newId } from "@/blocks/types";
import { z } from "zod";

/**
 * Registry de bloques del page builder.
 *
 * Cada bloque tiene:
 *  - kind: identificador único (string)
 *  - label: nombre humano ES
 *  - icon: nombre lucide-react
 *  - group: agrupación en el palette
 *  - description: tooltip/help
 *  - canHaveChildren: si es contenedor
 *  - defaultProps: valores iniciales al insertar
 *  - propsSchema: Zod schema para validar props (server-side)
 *  - propsSpec: descripción de cada prop para el inspector (auto-form)
 *  - defaultChildren: hijos iniciales si canHaveChildren
 *
 * El RENDER server-side vive en `src/blocks/render.tsx` (componente por kind),
 * separado para evitar bundling de React server components junto con la spec
 * del builder cliente.
 */

export type PropKind =
  | "text"
  | "longtext"
  | "rich"
  | "number"
  | "boolean"
  | "color"
  | "select"
  | "image"
  | "url"
  | "spacing" // padding/margin like "py-12 px-4"
  | "align"
  | "icon"
  | "items"; // array of objects (for repeater-style props)

export type PropSpec = {
  key: string;
  label: string;
  kind: PropKind;
  description?: string;
  options?: { value: string; label: string }[];
  /** Para items, define el sub-spec de cada item */
  itemSpec?: PropSpec[];
  /** Para items, valor por defecto de un nuevo item */
  itemDefault?: Record<string, unknown>;
  /** Group/tab del inspector */
  group?: "Contenido" | "Estilo" | "Layout" | "Avanzado";
};

export type BlockSpec = {
  kind: BlockKind;
  label: string;
  icon: string;
  group:
    | "Estructura"
    | "Tipografía"
    | "Multimedia"
    | "Acción"
    | "Secciones"
    | "Especial"
    | "Plantillas";
  description: string;
  canHaveChildren: boolean;
  defaultProps: Record<string, unknown>;
  propsSpec: PropSpec[];
  propsSchema: z.ZodTypeAny;
  defaultChildren?: () => BlockNode[];
  /**
   * Si true, el bloque NO aparece en el palette de "añadir bloque" pero
   * sí se renderiza si está en el árbol y se puede editar desde el inspector.
   * Pensado para los bloques `tpl-*` instanciados por las plantillas: queremos
   * que el usuario los EDITE, no que los inserte sueltos (porque cada uno
   * forma parte de la composición espectacular de una plantilla concreta).
   */
  hiddenInPalette?: boolean;
};

// ============================================================
// Helpers para Zod props
// ============================================================
const colorRegex =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|oklch\(.+\)|var\(--.+\)|transparent|inherit)$/;
const alignEnum = z.enum(["left", "center", "right"]);
const sizeEnum = z.enum(["sm", "md", "lg", "xl"]);

/**
 * Schema reutilizable para campos URL en todos los bloques.
 *
 * Acepta SÓLO:
 *  - http(s)://...
 *  - URLs relativas (/path, /path?q=1, /path#h)
 *  - Anchors puros (#anchor)
 *  - mailto:, tel:
 *  - cadena vacía
 *
 * BLOQUEA explícitamente:
 *  - javascript:, data:, file:, ftp:, vbscript:, ... (cualquier protocolo no-whitelisted)
 *  - protocol-relative (//evil.com) — el browser las trata como cross-origin
 *  - URLs que comienzan con /\ (potencial bypass: /\evil.com)
 *  - whitespace, < > " (anti-attribute-break)
 *
 * Implementación con `isSafeUrl()` (función) en vez de regex monolítico —
 * más legible y robusta vs casos como `JaVaScRiPt:`, leading whitespace,
 * control chars.
 *
 * Aplicado a ctaHref, primaryHref, secondaryHref, button.href, video.url,
 * embed.url, iframe src, pricing items[].href, etc. Live-Edit y editor admin
 * usan `validateProps()` que lo aplica server-side antes de persistir.
 */
export function isSafeUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length > 2048) return false;
  if (value === "") return true;
  // Rechaza control chars (0x00-0x1f, 0x7f), whitespace al inicio, comillas, ángulos.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intencional — bloqueamos URLs con control chars (anti-XSS, anti-bypass de parsers HTML).
  if (/[\x00-\x1f\x7f]/.test(value)) return false;
  if (/^\s/.test(value)) return false;
  if (/[\s<>"]/.test(value)) return false;
  // Anchors puros
  if (value.startsWith("#")) return !value.includes("\\");
  // mailto:, tel: (alfanumérico/símbolos seguros tras los dos puntos)
  if (/^mailto:[^\s<>"]+$/i.test(value)) return true;
  if (/^tel:[+0-9\-() .]+$/i.test(value)) return true;
  // http(s)://... (al menos 1 char tras //)
  if (/^https?:\/\/[^\s<>"]+$/i.test(value)) return true;
  // Path absoluta /... — rechaza protocol-relative `//` y bypass `/\`
  if (value.startsWith("/")) {
    if (value.startsWith("//") || value.startsWith("/\\")) return false;
    return !/[\\]/.test(value);
  }
  return false;
}

const safeUrl = (defaultValue = "") =>
  z
    .string()
    .max(2048)
    .refine(isSafeUrl, {
      message: "URL inválida (sólo http(s), rutas relativas, anchor, mailto:, tel:, vacío)",
    })
    .default(defaultValue);

/**
 * Variante de `safeUrl` para fields image/avatar/backgroundImage que típicamente
 * vienen del DAM (UploadThing/Vercel Blob) o son `null` cuando no se ha elegido.
 *
 * Acepta: null, undefined, cadena vacía, http(s)://..., paths relativos.
 * Bloquea: `data:`, `javascript:`, `file:`, protocol-relative `//`, `/\bypass`.
 *
 * Aunque el inspector del builder muestra un picker (no un input libre), el
 * `propsSchema` corre server-side y debe defender en profundidad: un cliente
 * malicioso podría enviar JSON crudo que omita el picker. El motor de render
 * pinta `src` directamente — sin esta whitelist quedaba la puerta abierta a
 * XSS de almacenamiento si un editor comprometido escribía `data:text/html,<script>`.
 */
const safeUrlNullable = () =>
  z
    .string()
    .max(2048)
    .refine(isSafeUrl, {
      message: "URL inválida (sólo http(s), rutas relativas, vacío)",
    })
    .nullable()
    .optional();

// ============================================================
// Definiciones
// ============================================================
const SECTION: BlockSpec = {
  kind: "section",
  label: "Sección",
  icon: "Square",
  group: "Estructura",
  description: "Contenedor de ancho completo con fondo y padding",
  canHaveChildren: true,
  defaultProps: {
    background: "transparent",
    padding: "py-20 px-6",
    align: "center",
    backgroundImage: null,
  },
  propsSpec: [
    { key: "background", label: "Color de fondo", kind: "color", group: "Estilo" },
    {
      key: "padding",
      label: "Espaciado interior",
      kind: "select",
      group: "Layout",
      options: [
        { value: "py-8 px-4", label: "Compacto" },
        { value: "py-12 px-6", label: "Cómodo" },
        { value: "py-20 px-6", label: "Espacioso" },
        { value: "py-32 px-6", label: "Muy espacioso" },
      ],
    },
    { key: "align", label: "Alineación", kind: "align", group: "Layout" },
    { key: "backgroundImage", label: "Imagen de fondo", kind: "image", group: "Estilo" },
  ],
  propsSchema: z
    .object({
      background: z.string().regex(colorRegex).default("transparent"),
      padding: z.string().default("py-20 px-6"),
      align: alignEnum.default("center"),
      backgroundImage: safeUrlNullable(),
    })
    .partial(),
};

const CONTAINER: BlockSpec = {
  kind: "container",
  label: "Contenedor",
  icon: "Box",
  group: "Estructura",
  description: "Wrapper con ancho máximo y centrado",
  canHaveChildren: true,
  defaultProps: { maxWidth: "lg", gap: "gap-6" },
  propsSpec: [
    {
      key: "maxWidth",
      label: "Ancho máximo",
      kind: "select",
      group: "Layout",
      options: [
        { value: "sm", label: "Pequeño (640)" },
        { value: "md", label: "Medio (768)" },
        { value: "lg", label: "Grande (1024)" },
        { value: "xl", label: "Extra (1280)" },
        { value: "2xl", label: "2XL (1536)" },
        { value: "full", label: "Completo" },
      ],
    },
    {
      key: "gap",
      label: "Espacio entre hijos",
      kind: "select",
      group: "Layout",
      options: [
        { value: "gap-2", label: "XS" },
        { value: "gap-4", label: "S" },
        { value: "gap-6", label: "M" },
        { value: "gap-10", label: "L" },
        { value: "gap-16", label: "XL" },
      ],
    },
  ],
  propsSchema: z
    .object({
      maxWidth: z.enum(["sm", "md", "lg", "xl", "2xl", "full"]).default("lg"),
      gap: z.string().default("gap-6"),
    })
    .partial(),
};

const COLUMNS: BlockSpec = {
  kind: "columns",
  label: "Columnas",
  icon: "Columns",
  group: "Estructura",
  description: "Grid responsive de 1-4 columnas",
  canHaveChildren: true,
  defaultProps: { count: 2, gap: "gap-6", align: "stretch" },
  propsSpec: [
    {
      key: "count",
      label: "Nº columnas",
      kind: "select",
      group: "Layout",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
    {
      key: "gap",
      label: "Espacio",
      kind: "select",
      group: "Layout",
      options: [
        { value: "gap-2", label: "XS" },
        { value: "gap-4", label: "S" },
        { value: "gap-6", label: "M" },
        { value: "gap-10", label: "L" },
      ],
    },
    {
      key: "align",
      label: "Alineación vertical",
      kind: "select",
      group: "Layout",
      options: [
        { value: "start", label: "Arriba" },
        { value: "center", label: "Centrado" },
        { value: "end", label: "Abajo" },
        { value: "stretch", label: "Estirar" },
      ],
    },
  ],
  propsSchema: z
    .object({
      count: z.coerce.number().int().min(1).max(4).default(2),
      gap: z.string().default("gap-6"),
      align: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
    })
    .partial(),
};

const HEADING: BlockSpec = {
  kind: "heading",
  label: "Título",
  icon: "Heading",
  group: "Tipografía",
  description: "h1-h6 con tamaño/peso/color",
  canHaveChildren: false,
  defaultProps: { text: "Título espectacular", level: 2, size: "xl", align: "left", color: "" },
  propsSpec: [
    { key: "text", label: "Texto", kind: "text", group: "Contenido" },
    {
      key: "level",
      label: "Nivel",
      kind: "select",
      group: "Contenido",
      options: [
        { value: "1", label: "H1" },
        { value: "2", label: "H2" },
        { value: "3", label: "H3" },
        { value: "4", label: "H4" },
      ],
    },
    {
      key: "size",
      label: "Tamaño",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "sm", label: "Pequeño" },
        { value: "md", label: "Medio" },
        { value: "lg", label: "Grande" },
        { value: "xl", label: "Extra" },
      ],
    },
    { key: "align", label: "Alineación", kind: "align", group: "Estilo" },
    { key: "color", label: "Color", kind: "color", group: "Estilo" },
  ],
  propsSchema: z
    .object({
      text: z.string().default(""),
      level: z.coerce.number().int().min(1).max(6).default(2),
      size: sizeEnum.default("xl"),
      align: alignEnum.default("left"),
      color: z.string().default(""),
    })
    .partial(),
};

const TEXT: BlockSpec = {
  kind: "text",
  label: "Texto",
  icon: "Text",
  group: "Tipografía",
  description: "Párrafo simple con tamaño/color/alineación",
  canHaveChildren: false,
  defaultProps: {
    text: "Escribe aquí tu texto. Puedes usar **negrita** y *cursiva* en formato Markdown sencillo.",
    size: "md",
    align: "left",
    color: "",
  },
  propsSpec: [
    { key: "text", label: "Texto", kind: "longtext", group: "Contenido" },
    {
      key: "size",
      label: "Tamaño",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "sm", label: "Pequeño" },
        { value: "md", label: "Medio" },
        { value: "lg", label: "Grande" },
        { value: "xl", label: "Lead" },
      ],
    },
    { key: "align", label: "Alineación", kind: "align", group: "Estilo" },
    { key: "color", label: "Color", kind: "color", group: "Estilo" },
  ],
  propsSchema: z
    .object({
      text: z.string().default(""),
      size: sizeEnum.default("md"),
      align: alignEnum.default("left"),
      color: z.string().default(""),
    })
    .partial(),
};

const RICH: BlockSpec = {
  kind: "rich",
  label: "Texto enriquecido",
  icon: "BookText",
  group: "Tipografía",
  description: "Documento Tiptap completo (render JSON)",
  canHaveChildren: false,
  defaultProps: { doc: { type: "doc", content: [{ type: "paragraph" }] } },
  propsSpec: [{ key: "doc", label: "Documento", kind: "rich", group: "Contenido" }],
  propsSchema: z
    .object({
      doc: z
        .object({ type: z.literal("doc"), content: z.array(z.unknown()).default([]) })
        .passthrough(),
    })
    .partial(),
};

const IMAGE: BlockSpec = {
  kind: "image",
  label: "Imagen",
  icon: "Image",
  group: "Multimedia",
  description: "Una imagen del DAM con alt y tamaño",
  canHaveChildren: false,
  defaultProps: { src: null, alt: "", width: "full", rounded: true, aspectRatio: "auto" },
  propsSpec: [
    { key: "src", label: "Imagen", kind: "image", group: "Contenido" },
    { key: "alt", label: "Texto alternativo", kind: "text", group: "Contenido" },
    {
      key: "width",
      label: "Ancho",
      kind: "select",
      group: "Layout",
      options: [
        { value: "sm", label: "Pequeña (320)" },
        { value: "md", label: "Media (640)" },
        { value: "lg", label: "Grande (960)" },
        { value: "full", label: "Completa" },
      ],
    },
    {
      key: "aspectRatio",
      label: "Ratio",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "auto", label: "Automático" },
        { value: "1/1", label: "Cuadrado" },
        { value: "16/9", label: "16:9" },
        { value: "4/3", label: "4:3" },
        { value: "9/16", label: "Vertical 9:16" },
      ],
    },
    { key: "rounded", label: "Bordes redondeados", kind: "boolean", group: "Estilo" },
  ],
  propsSchema: z
    .object({
      src: safeUrlNullable(),
      alt: z.string().default(""),
      width: z.enum(["sm", "md", "lg", "full"]).default("full"),
      aspectRatio: z.enum(["auto", "1/1", "16/9", "4/3", "9/16"]).default("auto"),
      rounded: z.boolean().default(true),
    })
    .partial(),
};

const GALLERY: BlockSpec = {
  kind: "gallery",
  label: "Galería",
  icon: "Images",
  group: "Multimedia",
  description: "Grid de imágenes",
  canHaveChildren: false,
  defaultProps: { items: [], columns: 3, gap: "gap-3" },
  propsSpec: [
    {
      key: "items",
      label: "Imágenes",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "src", label: "Imagen", kind: "image" },
        { key: "alt", label: "Alt", kind: "text" },
      ],
      itemDefault: { src: null, alt: "" },
    },
    {
      key: "columns",
      label: "Columnas",
      kind: "select",
      group: "Layout",
      options: [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
    {
      key: "gap",
      label: "Espacio",
      kind: "select",
      group: "Layout",
      options: [
        { value: "gap-1", label: "XS" },
        { value: "gap-3", label: "S" },
        { value: "gap-6", label: "M" },
      ],
    },
  ],
  propsSchema: z
    .object({
      items: z.array(z.object({ src: safeUrlNullable(), alt: z.string().default("") })).default([]),
      columns: z.coerce.number().int().min(2).max(4).default(3),
      gap: z.string().default("gap-3"),
    })
    .partial(),
};

const VIDEO: BlockSpec = {
  kind: "video",
  label: "Vídeo",
  icon: "Video",
  group: "Multimedia",
  description: "Embed de YouTube o Vimeo",
  canHaveChildren: false,
  defaultProps: { url: "", aspectRatio: "16/9", autoplay: false },
  propsSpec: [
    { key: "url", label: "URL del vídeo", kind: "url", group: "Contenido" },
    {
      key: "aspectRatio",
      label: "Ratio",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "16/9", label: "16:9" },
        { value: "4/3", label: "4:3" },
        { value: "1/1", label: "1:1" },
        { value: "9/16", label: "Vertical" },
      ],
    },
    { key: "autoplay", label: "Autoplay", kind: "boolean", group: "Avanzado" },
  ],
  propsSchema: z
    .object({
      url: safeUrl(""),
      aspectRatio: z.enum(["16/9", "4/3", "1/1", "9/16"]).default("16/9"),
      autoplay: z.boolean().default(false),
    })
    .partial(),
};

const EMBED: BlockSpec = {
  kind: "embed",
  label: "Embed",
  icon: "Code2",
  group: "Multimedia",
  description: "Iframe genérico (Twitter, CodePen, Figma, etc.)",
  canHaveChildren: false,
  defaultProps: { url: "", height: 480 },
  propsSpec: [
    { key: "url", label: "URL", kind: "url", group: "Contenido" },
    { key: "height", label: "Alto (px)", kind: "number", group: "Layout" },
  ],
  propsSchema: z
    .object({
      url: safeUrl(""),
      height: z.coerce.number().int().min(80).max(2000).default(480),
    })
    .partial(),
};

const BUTTON: BlockSpec = {
  kind: "button",
  label: "Botón",
  icon: "MousePointerClick",
  group: "Acción",
  description: "Enlace estilizado como botón",
  canHaveChildren: false,
  defaultProps: { text: "Hacer click", href: "#", variant: "primary", size: "md", align: "left" },
  propsSpec: [
    { key: "text", label: "Texto", kind: "text", group: "Contenido" },
    { key: "href", label: "URL", kind: "url", group: "Contenido" },
    {
      key: "variant",
      label: "Estilo",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "primary", label: "Primario" },
        { value: "secondary", label: "Secundario" },
        { value: "ghost", label: "Ghost" },
        { value: "outline", label: "Outline" },
      ],
    },
    {
      key: "size",
      label: "Tamaño",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "sm", label: "Pequeño" },
        { value: "md", label: "Medio" },
        { value: "lg", label: "Grande" },
      ],
    },
    { key: "align", label: "Alineación", kind: "align", group: "Layout" },
  ],
  propsSchema: z
    .object({
      text: z.string().default("Botón"),
      href: safeUrl("#"),
      variant: z.enum(["primary", "secondary", "ghost", "outline"]).default("primary"),
      size: z.enum(["sm", "md", "lg"]).default("md"),
      align: alignEnum.default("left"),
    })
    .partial(),
};

const CTA: BlockSpec = {
  kind: "cta",
  label: "Llamada a la acción",
  icon: "Megaphone",
  group: "Secciones",
  description: "Hero compacto con título + texto + botón",
  canHaveChildren: false,
  defaultProps: {
    eyebrow: "",
    title: "Algo espectacular te espera",
    subtitle: "Una breve descripción de por qué deberían actuar ahora.",
    primaryText: "Empezar gratis",
    primaryHref: "#",
    secondaryText: "",
    secondaryHref: "",
    align: "center",
  },
  propsSpec: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "subtitle", label: "Subtítulo", kind: "longtext", group: "Contenido" },
    { key: "primaryText", label: "Botón primario", kind: "text", group: "Contenido" },
    { key: "primaryHref", label: "URL primario", kind: "url", group: "Contenido" },
    { key: "secondaryText", label: "Botón secundario", kind: "text", group: "Contenido" },
    { key: "secondaryHref", label: "URL secundario", kind: "url", group: "Contenido" },
    { key: "align", label: "Alineación", kind: "align", group: "Estilo" },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().default(""),
      title: z.string().default(""),
      subtitle: z.string().default(""),
      primaryText: z.string().default(""),
      primaryHref: safeUrl("#"),
      secondaryText: z.string().default(""),
      secondaryHref: safeUrl(""),
      align: alignEnum.default("center"),
    })
    .partial(),
};

const MOTION_HERO: BlockSpec = {
  kind: "motion-hero",
  label: "Hero animado",
  icon: "Sparkles",
  group: "Secciones",
  description:
    "Hero espectacular con 6 variants animados: Aurora, Magnetic, Spotlight, Typewriter, Marquee, Particles.",
  canHaveChildren: false,
  defaultProps: {
    variant: "aurora",
    badge: "✦ Nuevo",
    title: "Construye algo espectacular",
    subtitle: "Hero animado con Framer Motion. Editable como cualquier otro bloque.",
    primaryText: "Empezar",
    primaryHref: "#",
    secondaryText: "Ver demo",
    secondaryHref: "#",
    marqueeItems: ["Notion", "Vercel", "Linear", "Framer", "Stripe", "Resend"],
  },
  propsSpec: [
    {
      key: "variant",
      label: "Estilo de animación",
      kind: "select",
      group: "Estilo",
      description:
        "Aurora · gradiente blur. Magnetic · botones siguen cursor. Spotlight · cursor revela. Typewriter · type-on. Marquee · logos infinitos. Particles · red canvas.",
      options: [
        { value: "aurora", label: "Aurora — gradiente animado" },
        { value: "magnetic", label: "Magnetic — CTAs magnéticos" },
        { value: "spotlight", label: "Spotlight — cursor revela" },
        { value: "typewriter", label: "Typewriter — type-on" },
        { value: "marquee", label: "Marquee — logos infinitos" },
        { value: "particles", label: "Particles — red canvas" },
      ],
    },
    { key: "badge", label: "Badge", kind: "text", group: "Contenido" },
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "subtitle", label: "Subtítulo", kind: "longtext", group: "Contenido" },
    { key: "primaryText", label: "CTA primario", kind: "text", group: "Contenido" },
    { key: "primaryHref", label: "URL primario", kind: "url", group: "Contenido" },
    { key: "secondaryText", label: "CTA secundario", kind: "text", group: "Contenido" },
    { key: "secondaryHref", label: "URL secundario", kind: "url", group: "Contenido" },
    {
      key: "marqueeItems",
      label: "Items marquee (solo Marquee)",
      kind: "items",
      group: "Contenido",
      description: "Lista de logos / textos a desfilar. Solo afecta al variant Marquee.",
      itemSpec: [{ key: "label", label: "Texto", kind: "text" }],
      itemDefault: { label: "Marca" },
    },
  ],
  propsSchema: z
    .object({
      variant: z
        .enum(["aurora", "magnetic", "spotlight", "typewriter", "marquee", "particles"])
        .default("aurora"),
      badge: z.string().default(""),
      title: z.string().default(""),
      subtitle: z.string().default(""),
      primaryText: z.string().default(""),
      primaryHref: safeUrl("#"),
      secondaryText: z.string().default(""),
      secondaryHref: safeUrl("#"),
      // marqueeItems puede llegar como string[] (legacy) o array de objects {label}
      // para encajar con el itemSpec del inspector. Aceptamos ambos.
      marqueeItems: z
        .union([z.array(z.string()), z.array(z.object({ label: z.string() }))])
        .optional(),
    })
    .partial(),
};

const HERO: BlockSpec = {
  kind: "hero",
  label: "Hero",
  icon: "Sparkles",
  group: "Secciones",
  description: "Hero estelar con badge, título grande, subtítulo y CTAs",
  canHaveChildren: false,
  defaultProps: {
    badge: "✦ Nuevo",
    title: "Construye algo espectacular",
    subtitle: "Una plataforma moderna para publicar contenido sin fricción.",
    primaryText: "Empezar gratis",
    primaryHref: "#",
    secondaryText: "Ver demo",
    secondaryHref: "#",
    image: null,
    layout: "centered",
    background: "aurora",
  },
  propsSpec: [
    { key: "badge", label: "Badge", kind: "text", group: "Contenido" },
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "subtitle", label: "Subtítulo", kind: "longtext", group: "Contenido" },
    { key: "primaryText", label: "CTA primario", kind: "text", group: "Contenido" },
    { key: "primaryHref", label: "URL primario", kind: "url", group: "Contenido" },
    { key: "secondaryText", label: "CTA secundario", kind: "text", group: "Contenido" },
    { key: "secondaryHref", label: "URL secundario", kind: "url", group: "Contenido" },
    { key: "image", label: "Imagen lateral", kind: "image", group: "Contenido" },
    {
      key: "layout",
      label: "Layout",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "centered", label: "Centrado" },
        { value: "split", label: "Split (texto + imagen)" },
      ],
    },
    {
      key: "background",
      label: "Fondo",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "aurora", label: "Aurora gradiente" },
        { value: "grid", label: "Grid sutil" },
        { value: "solid", label: "Color sólido" },
      ],
    },
  ],
  propsSchema: z
    .object({
      badge: z.string().default(""),
      title: z.string().default(""),
      subtitle: z.string().default(""),
      primaryText: z.string().default(""),
      primaryHref: safeUrl("#"),
      secondaryText: z.string().default(""),
      secondaryHref: safeUrl("#"),
      image: safeUrlNullable(),
      layout: z.enum(["centered", "split"]).default("centered"),
      background: z.enum(["aurora", "grid", "solid"]).default("aurora"),
    })
    .partial(),
};

const FEATURES_GRID: BlockSpec = {
  kind: "features-grid",
  label: "Grid de features",
  icon: "Grid3x3",
  group: "Secciones",
  description: "Lista de características con icono, título y descripción",
  canHaveChildren: false,
  defaultProps: {
    title: "Todo lo que necesitas",
    subtitle: "",
    items: [
      { icon: "Sparkles", title: "Espectacular", description: "Diseñado con detalle." },
      { icon: "Zap", title: "Rápido", description: "Construido sobre Edge runtime." },
      { icon: "ShieldCheck", title: "Seguro", description: "Auth y permisos sólidos." },
    ],
    columns: 3,
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "subtitle", label: "Subtítulo", kind: "longtext", group: "Contenido" },
    {
      key: "items",
      label: "Features",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "icon", label: "Icono (lucide)", kind: "icon" },
        { key: "title", label: "Título", kind: "text" },
        { key: "description", label: "Descripción", kind: "longtext" },
      ],
      itemDefault: { icon: "Sparkles", title: "", description: "" },
    },
    {
      key: "columns",
      label: "Columnas",
      kind: "select",
      group: "Layout",
      options: [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
  ],
  propsSchema: z
    .object({
      title: z.string().default(""),
      subtitle: z.string().default(""),
      items: z
        .array(
          z.object({
            icon: z.string().default("Sparkles"),
            title: z.string().default(""),
            description: z.string().default(""),
          }),
        )
        .default([]),
      columns: z.coerce.number().int().min(2).max(4).default(3),
    })
    .partial(),
};

const PRICING: BlockSpec = {
  kind: "pricing",
  label: "Precios",
  icon: "BadgeDollarSign",
  group: "Secciones",
  description: "Tabla de precios con planes",
  canHaveChildren: false,
  defaultProps: {
    title: "Planes simples",
    subtitle: "Elige el que mejor encaje contigo",
    items: [
      {
        name: "Free",
        price: "0",
        currency: "€",
        interval: "mes",
        features: "Hasta 100 posts\nDominio csm.dev\nComunidad",
        cta: "Empezar",
        href: "#",
        highlight: false,
      },
      {
        name: "Pro",
        price: "12",
        currency: "€",
        interval: "mes",
        features: "Todo Free\nDominio propio\nIA inline\nSoporte priority",
        cta: "Comprar",
        href: "#",
        highlight: true,
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "subtitle", label: "Subtítulo", kind: "longtext", group: "Contenido" },
    {
      key: "items",
      label: "Planes",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "name", label: "Nombre", kind: "text" },
        { key: "price", label: "Precio", kind: "text" },
        { key: "currency", label: "Moneda", kind: "text" },
        { key: "interval", label: "Intervalo", kind: "text" },
        { key: "features", label: "Features (1 por línea)", kind: "longtext" },
        { key: "cta", label: "Texto botón", kind: "text" },
        { key: "href", label: "URL", kind: "url" },
        { key: "highlight", label: "Destacado", kind: "boolean" },
      ],
      itemDefault: {
        name: "Plan",
        price: "0",
        currency: "€",
        interval: "mes",
        features: "",
        cta: "Elegir",
        href: "#",
        highlight: false,
      },
    },
  ],
  propsSchema: z
    .object({
      title: z.string().default(""),
      subtitle: z.string().default(""),
      items: z
        .array(
          z.object({
            name: z.string().default(""),
            price: z.string().default("0"),
            currency: z.string().default("€"),
            interval: z.string().default("mes"),
            features: z.string().default(""),
            cta: z.string().default(""),
            href: safeUrl("#"),
            highlight: z.boolean().default(false),
          }),
        )
        .default([]),
    })
    .partial(),
};

const TESTIMONIALS: BlockSpec = {
  kind: "testimonials",
  label: "Testimonios",
  icon: "MessageSquareQuote",
  group: "Secciones",
  description: "Cards con citas + autor",
  canHaveChildren: false,
  defaultProps: {
    title: "Lo que dicen",
    items: [
      { quote: "Lo mejor que probé este año.", author: "Ana", role: "CEO en Acme", avatar: null },
      { quote: "Ahorra horas a la semana.", author: "Luis", role: "Editor en BBlog", avatar: null },
    ],
    columns: 2,
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    {
      key: "items",
      label: "Testimonios",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "quote", label: "Cita", kind: "longtext" },
        { key: "author", label: "Autor", kind: "text" },
        { key: "role", label: "Rol", kind: "text" },
        { key: "avatar", label: "Avatar", kind: "image" },
      ],
      itemDefault: { quote: "", author: "", role: "", avatar: null },
    },
    {
      key: "columns",
      label: "Columnas",
      kind: "select",
      group: "Layout",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
      ],
    },
  ],
  propsSchema: z
    .object({
      title: z.string().default(""),
      items: z
        .array(
          z.object({
            quote: z.string().default(""),
            author: z.string().default(""),
            role: z.string().default(""),
            avatar: safeUrlNullable(),
          }),
        )
        .default([]),
      columns: z.coerce.number().int().min(1).max(3).default(2),
    })
    .partial(),
};

const FAQ: BlockSpec = {
  kind: "faq",
  label: "FAQ",
  icon: "MessageCircleQuestion",
  group: "Secciones",
  description: "Preguntas frecuentes en acordeón",
  canHaveChildren: false,
  defaultProps: {
    title: "Preguntas frecuentes",
    items: [
      { question: "¿Es gratis?", answer: "El plan Free no caduca." },
      { question: "¿Puedo cancelar?", answer: "Cuando quieras." },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    {
      key: "items",
      label: "Preguntas",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "question", label: "Pregunta", kind: "text" },
        { key: "answer", label: "Respuesta", kind: "longtext" },
      ],
      itemDefault: { question: "", answer: "" },
    },
  ],
  propsSchema: z
    .object({
      title: z.string().default(""),
      items: z
        .array(z.object({ question: z.string().default(""), answer: z.string().default("") }))
        .default([]),
    })
    .partial(),
};

const FOOTER_COLS: BlockSpec = {
  kind: "footer-cols",
  label: "Footer columnas",
  icon: "PanelBottom",
  group: "Secciones",
  description: "Footer con columnas de enlaces",
  canHaveChildren: false,
  defaultProps: {
    brand: "Tu marca",
    tagline: "Una breve descripción de la marca.",
    columns: [
      { title: "Producto", links: "Características | /caracteristicas\nPrecios | /precios" },
      { title: "Compañía", links: "Sobre nosotros | /sobre\nContacto | /contacto" },
    ],
    copyright: "© 2026 Tu marca. Todos los derechos reservados.",
  },
  propsSpec: [
    { key: "brand", label: "Marca", kind: "text", group: "Contenido" },
    { key: "tagline", label: "Tagline", kind: "longtext", group: "Contenido" },
    {
      key: "columns",
      label: "Columnas",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "title", label: "Título", kind: "text" },
        { key: "links", label: "Enlaces (Texto | /url, uno por línea)", kind: "longtext" },
      ],
      itemDefault: { title: "Sección", links: "Inicio | /\nBlog | /blog" },
    },
    { key: "copyright", label: "Copyright", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      brand: z.string().default(""),
      tagline: z.string().default(""),
      columns: z
        .array(z.object({ title: z.string().default(""), links: z.string().default("") }))
        .default([]),
      copyright: z.string().default(""),
    })
    .partial(),
};

const SPACER: BlockSpec = {
  kind: "spacer",
  label: "Espaciador",
  icon: "ArrowDownUp",
  group: "Estructura",
  description: "Espacio vertical en blanco",
  canHaveChildren: false,
  defaultProps: { size: "md" },
  propsSpec: [
    {
      key: "size",
      label: "Tamaño",
      kind: "select",
      group: "Layout",
      options: [
        { value: "sm", label: "Pequeño (16)" },
        { value: "md", label: "Medio (40)" },
        { value: "lg", label: "Grande (96)" },
        { value: "xl", label: "Enorme (160)" },
      ],
    },
  ],
  propsSchema: z.object({ size: sizeEnum.default("md") }).partial(),
};

const DIVIDER: BlockSpec = {
  kind: "divider",
  label: "Divisor",
  icon: "Minus",
  group: "Estructura",
  description: "Línea horizontal",
  canHaveChildren: false,
  defaultProps: { color: "" },
  propsSpec: [{ key: "color", label: "Color", kind: "color", group: "Estilo" }],
  propsSchema: z.object({ color: z.string().default("") }).partial(),
};

const PAYWALL: BlockSpec = {
  kind: "paywall",
  label: "Paywall",
  icon: "Lock",
  group: "Especial",
  description:
    "Gate de contenido — todo lo que viene DESPUÉS sólo se muestra a miembros que cumplen la condición.",
  canHaveChildren: false,
  defaultProps: {
    gateType: "any-tier",
    tierIds: [] as string[],
    title: "Contenido para miembros",
    message:
      "Suscríbete o inicia sesión para seguir leyendo este artículo y acceder a todo el archivo.",
    ctaLabel: "Hacerme miembro",
    ctaHref: "/miembros",
    secondaryLabel: "Ya soy miembro",
    secondaryHref: "/miembros",
    teaser: "fade",
  },
  propsSpec: [
    {
      key: "gateType",
      label: "Tipo de gate",
      kind: "select",
      group: "Contenido",
      options: [
        { value: "logged-in", label: "Cualquier miembro logueado" },
        { value: "any-tier", label: "Cualquier membresía activa" },
        { value: "specific-tiers", label: "Sólo tiers específicos" },
      ],
    },
    {
      key: "tierIds",
      label: "IDs de tiers (separados por coma)",
      kind: "longtext",
      group: "Contenido",
      description: "Sólo aplica si gate=specific-tiers",
    },
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "message", label: "Mensaje", kind: "longtext", group: "Contenido" },
    { key: "ctaLabel", label: "Botón principal", kind: "text", group: "Contenido" },
    { key: "ctaHref", label: "URL principal", kind: "url", group: "Contenido" },
    { key: "secondaryLabel", label: "Botón secundario", kind: "text", group: "Contenido" },
    { key: "secondaryHref", label: "URL secundaria", kind: "url", group: "Contenido" },
    {
      key: "teaser",
      label: "Estilo teaser",
      kind: "select",
      group: "Estilo",
      options: [
        { value: "fade", label: "Fade gradiente al cortar" },
        { value: "hard", label: "Corte limpio" },
      ],
    },
  ],
  propsSchema: z
    .object({
      gateType: z.enum(["logged-in", "any-tier", "specific-tiers"]).default("any-tier"),
      tierIds: z
        .union([z.string(), z.array(z.string())])
        .transform((v) =>
          Array.isArray(v)
            ? v.filter((s) => /^[0-9a-f-]{36}$/.test(s))
            : v
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter((s) => /^[0-9a-f-]{36}$/.test(s)),
        )
        .default([]),
      title: z.string().default("Contenido para miembros"),
      message: z.string().default(""),
      ctaLabel: z.string().default("Hacerme miembro"),
      ctaHref: safeUrl("/miembros"),
      secondaryLabel: z.string().default(""),
      secondaryHref: safeUrl(""),
      teaser: z.enum(["fade", "hard"]).default("fade"),
    })
    .partial(),
};

const SYMBOL: BlockSpec = {
  kind: "symbol",
  label: "Símbolo",
  icon: "Component",
  group: "Especial",
  description: "Inserta un componente reusable de tu workspace",
  canHaveChildren: false,
  defaultProps: { symbolId: null },
  propsSpec: [
    {
      key: "symbolId",
      label: "Símbolo",
      kind: "select",
      group: "Contenido",
      description: "Elige uno desde Símbolos",
      options: [],
    },
  ],
  propsSchema: z.object({ symbolId: z.string().nullable().optional() }).partial(),
};

/**
 * Bloque A/B: contiene N hijos. Cada hijo debe ser un bloque "ab-variant"
 * con prop `variantId`. En SSR el render lee `ctx.abMap` para el `testKey`
 * y muestra sólo el child cuyo variantId matchea. Si no hay test activo o
 * el viewer es admin con bypassGates, se muestra el primer child (control).
 */
const AB_GROUP: BlockSpec = {
  kind: "ab",
  label: "Variantes A/B",
  icon: "FlaskConical",
  group: "Especial",
  description:
    "Muestra una variante distinta a cada visitante según un test A/B. Los hijos deben ser bloques 'Variante'.",
  canHaveChildren: true,
  defaultProps: {
    testKey: "",
  },
  propsSpec: [
    {
      key: "testKey",
      label: "Key del test",
      kind: "text",
      group: "Contenido",
      description: "Slug del test A/B definido en /admin/ab-tests",
    },
  ],
  // testKey vacío es válido durante drag-drop (acaba de insertarse el bloque);
  // el render hace fallback a primer child. La estrictez ocurre en `collectAbKeys`
  // (filtra con regex `{1,64}` requiriendo al menos 1 char) y en server
  // actions de admin (rejectan create/update con testKey vacío).
  propsSchema: z
    .object({
      testKey: z
        .string()
        .max(64)
        .regex(/^[a-z0-9_-]*$/i, "Sólo letras, números, _ y -")
        .default(""),
    })
    .partial(),
  defaultChildren: () => [
    {
      id: newId(),
      kind: "ab-variant",
      props: { variantId: "control", label: "Control" },
      children: [],
    },
    {
      id: newId(),
      kind: "ab-variant",
      props: { variantId: "v1", label: "Variante 1" },
      children: [],
    },
  ],
};

/**
 * Hijo de "ab": container que se muestra solo si la variant resuelta para
 * el testKey del padre coincide con `variantId`. La selección la hace el
 * render, este bloque sólo encapsula contenido.
 */
const AB_VARIANT: BlockSpec = {
  kind: "ab-variant",
  label: "Variante",
  icon: "Split",
  group: "Especial",
  description: "Wrapper de un branch de un test A/B. Insertar dentro de 'Variantes A/B'.",
  canHaveChildren: true,
  defaultProps: {
    variantId: "v1",
    label: "Variante",
  },
  propsSpec: [
    {
      key: "variantId",
      label: "ID de la variante",
      kind: "text",
      group: "Contenido",
      description: "Debe coincidir con un id de variant en el test",
    },
    { key: "label", label: "Etiqueta humana", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      variantId: z
        .string()
        .max(32)
        .regex(/^[a-z0-9_-]+$/i)
        .default("v1"),
      label: z.string().max(120).default(""),
    })
    .partial(),
};

// ============================================================
// Registry
// ============================================================
export const BLOCK_SPECS: BlockSpec[] = [
  SECTION,
  CONTAINER,
  COLUMNS,
  HEADING,
  TEXT,
  RICH,
  IMAGE,
  GALLERY,
  VIDEO,
  EMBED,
  BUTTON,
  CTA,
  HERO,
  MOTION_HERO,
  FEATURES_GRID,
  PRICING,
  TESTIMONIALS,
  FAQ,
  FOOTER_COLS,
  SPACER,
  DIVIDER,
  PAYWALL,
  SYMBOL,
  AB_GROUP,
  AB_VARIANT,
  // Bloques de plantillas espectaculares (tpl-*) — hidden del palette,
  // editables vía inspector. Renderizados como client components 1:1 con
  // las showcases originales.
  ...SPECTACULAR_SPECS,
];

const REGISTRY = new Map(BLOCK_SPECS.map((s) => [s.kind, s] as const));

export function getBlockSpec(kind: BlockKind): BlockSpec | null {
  return REGISTRY.get(kind) ?? null;
}

export function newBlockNode(kind: BlockKind): BlockNode {
  const spec = getBlockSpec(kind);
  if (!spec) throw new Error(`Bloque desconocido: ${kind}`);
  return {
    id: newId(),
    kind,
    props: structuredClone(spec.defaultProps),
    ...(spec.canHaveChildren ? { children: spec.defaultChildren?.() ?? [] } : {}),
  };
}

export function blocksByGroup(): Record<BlockSpec["group"], BlockSpec[]> {
  const out: Record<string, BlockSpec[]> = {};
  for (const s of BLOCK_SPECS) {
    // Bloques tpl-* se editan desde el inspector pero no aparecen en el palette
    // de "Añadir bloque" — son secciones de plantillas espectaculares.
    if (s.hiddenInPalette) continue;
    if (!out[s.group]) out[s.group] = [];
    out[s.group]!.push(s);
  }
  return out as Record<BlockSpec["group"], BlockSpec[]>;
}

/** Valida y normaliza props con el Zod schema del bloque. Devuelve defaults si falla. */
export function validateProps(kind: BlockKind, raw: unknown): Record<string, unknown> {
  const spec = getBlockSpec(kind);
  if (!spec) return {};
  const parsed = spec.propsSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return { ...spec.defaultProps, ...(parsed.data as Record<string, unknown>) };
  }
  return { ...spec.defaultProps };
}
