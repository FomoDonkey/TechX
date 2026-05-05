/**
 * Block specs de las plantillas espectaculares (`tpl-*`).
 *
 * Cada plantilla showcase (`saas-magnetic`, `portfolio-spotlight`, etc.) se
 * descompone en 4-7 secciones, cada una con su propio block kind y schema.
 * Los bloques tienen `hiddenInPalette: true` para no inundar el palette del
 * page builder; aparecen vía `buildLayout()` al insertar la plantilla y se
 * editan desde el inspector.
 *
 * Convenciones:
 *  - kind: `tpl-{showcase}-{section}` (ej. `tpl-asme-hero`).
 *  - icon: misma lucide para toda una familia (`Sparkles`).
 *  - group: "Plantillas" (nuevo grupo añadido al BlockSpec.group enum).
 *  - propsSchema: Zod estricto. Defaults aplicados via `validateProps()`.
 *  - propsSpec: campos editables agrupados por `Contenido | Estilo | Layout | Avanzado`.
 */

import type { BlockSpec, PropSpec } from "@/blocks/registry";
import { z } from "zod";

// ============================================================
// Helpers
// ============================================================
const safeUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (v) => {
      if (typeof v !== "string") return false;
      if (v === "") return true;
      if (/[\x00-\x1f\x7f<>"]/.test(v)) return false;
      if (v.startsWith("#")) return true;
      if (/^https?:\/\/[^\s<>"]+$/i.test(v)) return true;
      if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return true;
      return false;
    },
    { message: "URL inválida" },
  );

const httpVideoUrl = z
  .string()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\/[^\s<>"]+\.(mp4|webm|m3u8)(\?.*)?$/i.test(v), {
    message: "URL de vídeo inválida (.mp4 / .webm / .m3u8)",
  })
  .default("");

const httpImgUrl = z
  .string()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\/[^\s<>"]+$/i.test(v), {
    message: "URL de imagen inválida",
  })
  .default("");

const linkItemZ = z.object({ label: z.string().default(""), href: safeUrlSchema.default("#") });

// ============================================================
// 1. tpl-asme-hero — Hero video crossfade + glass nav + email pill
// ============================================================
const ASME_HERO: BlockSpec = {
  kind: "tpl-asme-hero",
  label: "Asme · Hero glass video",
  icon: "Sparkles",
  group: "Plantillas",
  description:
    "Hero spectacular Asme: vídeo fullscreen con crossfade, navbar glass-pill, email signup y manifesto. Estilo Instrument Serif italic.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    brand: "asme",
    navItems: [
      { label: "Producto", href: "#producto" },
      { label: "Precios", href: "#precios" },
      { label: "Sobre", href: "#sobre" },
    ],
    signupText: "Crear cuenta",
    loginText: "Iniciar sesión",
    loginHref: "#login",
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4",
    titleHtml: "Conoce <em>todo</em>",
    emailPlaceholder: "Tu email",
    subtitle:
      "Mantente al día con las novedades. Suscríbete y nunca te pierdas las actualizaciones más interesantes.",
    manifestoText: "Manifiesto",
    socials: ["instagram", "twitter", "globe"],
  },
  propsSpec: [
    { key: "brand", label: "Marca", kind: "text", group: "Contenido" },
    {
      key: "titleHtml",
      label: "Título (admite <em>italic</em>)",
      kind: "longtext",
      group: "Contenido",
    },
    { key: "subtitle", label: "Subtítulo", kind: "longtext", group: "Contenido" },
    { key: "emailPlaceholder", label: "Placeholder email", kind: "text", group: "Contenido" },
    { key: "manifestoText", label: "Botón manifiesto", kind: "text", group: "Contenido" },
    { key: "signupText", label: "Texto Signup nav", kind: "text", group: "Contenido" },
    { key: "loginText", label: "Texto Login nav", kind: "text", group: "Contenido" },
    { key: "loginHref", label: "URL Login", kind: "url", group: "Contenido" },
    {
      key: "videoUrl",
      label: "URL vídeo de fondo (mp4)",
      kind: "url",
      group: "Contenido",
      description: "Vídeo loop con crossfade. Mejor 1080p+ silencioso.",
    },
    {
      key: "navItems",
      label: "Nav links",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Texto", kind: "text" },
        { key: "href", label: "URL", kind: "url" },
      ],
      itemDefault: { label: "Item", href: "#" },
    },
    {
      key: "socials",
      label: "Iconos sociales (instagram|twitter|globe)",
      kind: "items",
      group: "Contenido",
      description: "Cada item: 'instagram', 'twitter' o 'globe'.",
      itemSpec: [{ key: "key", label: "Icono", kind: "text" }],
      itemDefault: { key: "globe" },
    },
  ],
  propsSchema: z
    .object({
      brand: z.string().max(60).default(""),
      navItems: z.array(linkItemZ).default([]),
      signupText: z.string().max(40).default(""),
      loginText: z.string().max(40).default(""),
      loginHref: safeUrlSchema.default("#"),
      videoUrl: httpVideoUrl,
      titleHtml: z.string().max(280).default(""),
      emailPlaceholder: z.string().max(80).default(""),
      subtitle: z.string().max(400).default(""),
      manifestoText: z.string().max(40).default(""),
      // socials puede llegar como string[] (legacy) o {key}[] (inspector items)
      socials: z
        .union([
          z.array(z.enum(["instagram", "twitter", "globe"])),
          z.array(z.object({ key: z.enum(["instagram", "twitter", "globe"]) })),
        ])
        .default([]),
    })
    .partial(),
};

// ============================================================
// 2. tpl-asme-about — eyebrow + huge italic headline
// ============================================================
const ASME_ABOUT: BlockSpec = {
  kind: "tpl-asme-about",
  label: "Asme · About headline",
  icon: "Sparkles",
  group: "Plantillas",
  description: "Sección about con eyebrow tracking-widest y h2 enorme con fragmentos italic.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Sobre nosotros",
    titleHtml:
      "Innovando <em>ideas</em> para<br/> <em>mentes que crean, construyen e inspiran.</em>",
    anchorId: "sobre",
  },
  propsSpec: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    {
      key: "titleHtml",
      label: "Título (admite <em> y <br/>)",
      kind: "longtext",
      group: "Contenido",
    },
    {
      key: "anchorId",
      label: "ID ancla",
      kind: "text",
      group: "Avanzado",
      description: "Permite enlazar desde nav (#sobre).",
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      titleHtml: z.string().max(500).default(""),
      anchorId: z.string().max(60).default(""),
    })
    .partial(),
};

// ============================================================
// 3. tpl-asme-featured-video — video full-bleed + glass card overlay
// ============================================================
const ASME_FEATURED_VIDEO: BlockSpec = {
  kind: "tpl-asme-featured-video",
  label: "Asme · Featured video",
  icon: "Video",
  group: "Plantillas",
  description: "Vídeo full-bleed con tarjeta glassmorphism encima y CTA glass.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4",
    cardEyebrow: "Nuestro enfoque",
    cardText:
      "Creemos en el poder de la curiosidad. Cada proyecto empieza con una pregunta — y cada respuesta abre una nueva puerta a la innovación.",
    buttonText: "Explorar más",
  },
  propsSpec: [
    { key: "videoUrl", label: "URL vídeo", kind: "url", group: "Contenido" },
    { key: "cardEyebrow", label: "Eyebrow tarjeta", kind: "text", group: "Contenido" },
    { key: "cardText", label: "Texto tarjeta", kind: "longtext", group: "Contenido" },
    { key: "buttonText", label: "Botón (vacío = ocultar)", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      videoUrl: httpVideoUrl,
      cardEyebrow: z.string().max(80).default(""),
      cardText: z.string().max(500).default(""),
      buttonText: z.string().max(60).default(""),
    })
    .partial(),
};

// ============================================================
// 4. tpl-asme-split-vision — 2 col video + texto separado por divider
// ============================================================
const ASME_SPLIT_VISION: BlockSpec = {
  kind: "tpl-asme-split-vision",
  label: "Asme · Split vision",
  icon: "Columns2",
  group: "Plantillas",
  description: "Split 2 columnas: vídeo aspect-[4/3] + 2 bloques de texto con divider.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    titleHtml: "Innovación <em>×</em> Visión",
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4",
    block1Eyebrow: "Elige tu espacio",
    block1Body:
      "Cada salto importante nace en la intersección entre estrategia disciplinada y visión creativa. Operamos en ese cruce, convirtiendo el pensamiento en resultados que mueven personas e industrias.",
    block2Eyebrow: "Da forma al futuro",
    block2Body:
      "Lo mejor surge cuando la curiosidad se encuentra con la convicción. Nuestro proceso descubre oportunidades ocultas y las traduce en experiencias que perduran.",
  },
  propsSpec: [
    { key: "titleHtml", label: "Título (admite <em>)", kind: "text", group: "Contenido" },
    { key: "videoUrl", label: "URL vídeo (4:3)", kind: "url", group: "Contenido" },
    { key: "block1Eyebrow", label: "Bloque 1 — Eyebrow", kind: "text", group: "Contenido" },
    { key: "block1Body", label: "Bloque 1 — Texto", kind: "longtext", group: "Contenido" },
    { key: "block2Eyebrow", label: "Bloque 2 — Eyebrow", kind: "text", group: "Contenido" },
    { key: "block2Body", label: "Bloque 2 — Texto", kind: "longtext", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      titleHtml: z.string().max(200).default(""),
      videoUrl: httpVideoUrl,
      block1Eyebrow: z.string().max(80).default(""),
      block1Body: z.string().max(600).default(""),
      block2Eyebrow: z.string().max(80).default(""),
      block2Body: z.string().max(600).default(""),
    })
    .partial(),
};

// ============================================================
// 5. tpl-asme-service-cards — 2 cards glass con video bg
// ============================================================
const ASME_SERVICE_CARDS: BlockSpec = {
  kind: "tpl-asme-service-cards",
  label: "Asme · Service cards",
  icon: "LayoutGrid",
  group: "Plantillas",
  description: "Cards glassmorphism con vídeo loop, tag, título y descripción. 2-up por defecto.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "producto",
    sectionTitle: "Lo que hacemos",
    sectionEyebrow: "Nuestros servicios",
    cards: [
      {
        tag: "Estrategia",
        title: "Investigación e insight",
        desc: "Escarbamos en datos, cultura y comportamiento humano para encontrar los insights que generan cambios duraderos.",
        videoUrl:
          "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4",
      },
      {
        tag: "Craft",
        title: "Diseño y ejecución",
        desc: "Del concepto al lanzamiento, obsesionamos con cada detalle para entregar experiencias que parecen sin esfuerzo.",
        videoUrl:
          "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4",
      },
    ],
  },
  propsSpec: [
    { key: "sectionTitle", label: "Título de sección", kind: "text", group: "Contenido" },
    { key: "sectionEyebrow", label: "Eyebrow lateral", kind: "text", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
    {
      key: "cards",
      label: "Cards de servicio",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "tag", label: "Tag", kind: "text" },
        { key: "title", label: "Título", kind: "text" },
        { key: "desc", label: "Descripción", kind: "longtext" },
        { key: "videoUrl", label: "URL vídeo", kind: "url" },
      ],
      itemDefault: { tag: "Tag", title: "Título", desc: "Descripción.", videoUrl: "" },
    },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default(""),
      sectionTitle: z.string().max(120).default(""),
      sectionEyebrow: z.string().max(80).default(""),
      cards: z
        .array(
          z.object({
            tag: z.string().max(60).default(""),
            title: z.string().max(120).default(""),
            desc: z.string().max(400).default(""),
            videoUrl: httpVideoUrl,
          }),
        )
        .default([]),
    })
    .partial(),
};

// ============================================================
// 6. tpl-asme-cta — centered con glass button + copyright
// ============================================================
const ASME_CTA: BlockSpec = {
  kind: "tpl-asme-cta",
  label: "Asme · CTA glass",
  icon: "Megaphone",
  group: "Plantillas",
  description: "CTA centrado con eyebrow, título italic gigante, glass button y copyright.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Empieza hoy",
    titleHtml: "Construye <em>algo distinto</em>",
    buttonText: "Empezar gratis →",
    buttonHref: "#",
    copyright: "© 2026 asme. Hecho con curiosidad.",
  },
  propsSpec: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "titleHtml", label: "Título (admite <em>)", kind: "text", group: "Contenido" },
    { key: "buttonText", label: "Texto botón", kind: "text", group: "Contenido" },
    { key: "buttonHref", label: "URL botón", kind: "url", group: "Contenido" },
    { key: "copyright", label: "Copyright", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      titleHtml: z.string().max(200).default(""),
      buttonText: z.string().max(60).default(""),
      buttonHref: safeUrlSchema.default("#"),
      copyright: z.string().max(200).default(""),
    })
    .partial(),
};

// ============================================================
// Plantilla 2 — Jack 3D Creator (`portfolio-spotlight`)
// ============================================================

const JACK_HERO: BlockSpec = {
  kind: "tpl-jack-hero",
  label: "Jack · Hero magnetic portrait",
  icon: "Sparkles",
  group: "Plantillas",
  description:
    "Hero portfolio Jack: navbar 4 links, 'Hi, i'm jack' gradient, retrato magnético y ContactPill. Fuente Kanit.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    navItems: [
      { label: "About", href: "#about" },
      { label: "Price", href: "#price" },
      { label: "Projects", href: "#projects" },
      { label: "Contact", href: "#contact" },
    ],
    titleText: "Hi, i'm jack",
    portraitUrl:
      "https://shrug-person-78902957.figma.site/_components/v2/d24c01ad3a56fc65e942a1f501eb73db42d7cf9a/Rectangle_40443.81459862.png",
    bottomCopy: "Un creador 3D que diseña proyectos memorables y de alto impacto",
    contactText: "Contact Me",
    contactHref: "#contact",
  },
  propsSpec: [
    { key: "titleText", label: "Título", kind: "text", group: "Contenido" },
    { key: "portraitUrl", label: "URL retrato", kind: "url", group: "Contenido" },
    { key: "bottomCopy", label: "Copy inferior", kind: "longtext", group: "Contenido" },
    { key: "contactText", label: "Texto botón contact", kind: "text", group: "Contenido" },
    { key: "contactHref", label: "URL botón contact", kind: "url", group: "Contenido" },
    {
      key: "navItems",
      label: "Nav links",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Texto", kind: "text" },
        { key: "href", label: "URL", kind: "url" },
      ],
      itemDefault: { label: "Item", href: "#" },
    },
  ],
  propsSchema: z
    .object({
      navItems: z.array(linkItemZ).default([]),
      titleText: z.string().max(120).default(""),
      portraitUrl: httpImgUrl,
      bottomCopy: z.string().max(280).default(""),
      contactText: z.string().max(40).default(""),
      contactHref: safeUrlSchema.default("#"),
    })
    .partial(),
};

const JACK_MARQUEE: BlockSpec = {
  kind: "tpl-jack-marquee",
  label: "Jack · Marquee 2 filas",
  icon: "Film",
  group: "Plantillas",
  description:
    "Doble marquee scroll-driven de 21 GIFs en filas opuestas (motionsites.ai by default).",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    gifs: [
      "https://motionsites.ai/assets/hero-space-voyage-preview-eECLH3Yc.gif",
      "https://motionsites.ai/assets/hero-codenest-preview-Cgppc2qV.gif",
      "https://motionsites.ai/assets/hero-vex-ventures-preview-BczMFIiw.gif",
      "https://motionsites.ai/assets/hero-stellar-ai-v2-preview-DjvxjG3C.gif",
      "https://motionsites.ai/assets/hero-asme-preview-B_nGDnTP.gif",
      "https://motionsites.ai/assets/hero-transform-data-preview-Cx5OU29N.gif",
      "https://motionsites.ai/assets/hero-vitara-preview-Cjz2QYyU.gif",
      "https://motionsites.ai/assets/hero-terra-preview-BFjrCr7T.gif",
      "https://motionsites.ai/assets/hero-skyelite-preview-DHaZIgUv.gif",
      "https://motionsites.ai/assets/hero-aethera-preview-DknSlcTa.gif",
      "https://motionsites.ai/assets/hero-designpro-preview-D8c5_een.gif",
      "https://motionsites.ai/assets/hero-stellar-ai-preview-D3HL6bw1.gif",
      "https://motionsites.ai/assets/hero-xportfolio-preview-D4A8maiC.gif",
      "https://motionsites.ai/assets/hero-orbit-web3-preview-BXt4OttD.gif",
      "https://motionsites.ai/assets/hero-nexora-preview-cx5HmUgo.gif",
      "https://motionsites.ai/assets/hero-evr-ventures-preview-DZxeVFEX.gif",
      "https://motionsites.ai/assets/hero-planet-orbit-preview-DWAP8Z1P.gif",
      "https://motionsites.ai/assets/hero-new-era-preview-CocuDUm9.gif",
      "https://motionsites.ai/assets/hero-wealth-preview-B70idl_u.gif",
      "https://motionsites.ai/assets/hero-luminex-preview-CxOP7ce6.gif",
      "https://motionsites.ai/assets/hero-celestia-preview-0yO3jXO8.gif",
    ],
    splitAt: 11,
  },
  propsSpec: [
    {
      key: "splitAt",
      label: "Items en fila 1 (resto va a fila 2)",
      kind: "number",
      group: "Layout",
    },
    {
      key: "gifs",
      label: "URLs de GIFs (uno por línea en items)",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "src", label: "URL", kind: "url" }],
      itemDefault: { src: "" },
    },
  ],
  propsSchema: z
    .object({
      // Acepta string[] o {src}[]
      gifs: z.union([z.array(httpImgUrl), z.array(z.object({ src: httpImgUrl }))]).default([]),
      splitAt: z.coerce.number().int().min(1).max(50).default(11),
    })
    .partial(),
};

const JACK_ABOUT: BlockSpec = {
  kind: "tpl-jack-about",
  label: "Jack · About + 3D corners",
  icon: "Sparkles",
  group: "Plantillas",
  description: "About me con 4 imágenes 3D en esquinas + char-reveal scroll-driven + ContactPill.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "about",
    cornerTopLeft:
      "https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/moon_icon.11395d36.png",
    cornerBottomLeft:
      "https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/p59_1.4659672e.png",
    cornerTopRight:
      "https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/lego_icon-1.703bb594.png",
    cornerBottomRight:
      "https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/Group_134-1.2e04f3ce.png",
    title: "About me",
    body: "Con más de cinco años de experiencia en diseño, me especializo en branding, web y experiencia de usuario. Disfruto trabajando con marcas que quieren destacar y mostrar su mejor cara. Construyamos juntos algo increíble.",
    contactText: "Contact Me",
    contactHref: "#contact",
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    {
      key: "body",
      label: "Texto (anim. char-reveal)",
      kind: "longtext",
      group: "Contenido",
    },
    { key: "contactText", label: "Texto botón", kind: "text", group: "Contenido" },
    { key: "contactHref", label: "URL botón", kind: "url", group: "Contenido" },
    { key: "cornerTopLeft", label: "Imagen esquina superior izq", kind: "url", group: "Estilo" },
    { key: "cornerBottomLeft", label: "Imagen esquina inferior izq", kind: "url", group: "Estilo" },
    { key: "cornerTopRight", label: "Imagen esquina superior der", kind: "url", group: "Estilo" },
    {
      key: "cornerBottomRight",
      label: "Imagen esquina inferior der",
      kind: "url",
      group: "Estilo",
    },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default("about"),
      cornerTopLeft: httpImgUrl,
      cornerBottomLeft: httpImgUrl,
      cornerTopRight: httpImgUrl,
      cornerBottomRight: httpImgUrl,
      title: z.string().max(120).default(""),
      body: z.string().max(800).default(""),
      contactText: z.string().max(40).default(""),
      contactHref: safeUrlSchema.default("#"),
    })
    .partial(),
};

const JACK_SERVICES: BlockSpec = {
  kind: "tpl-jack-services",
  label: "Jack · Services list white",
  icon: "ListOrdered",
  group: "Plantillas",
  description: "Lista numerada de servicios sobre fondo blanco, rounded-t-[60px], h2 hero-heading.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "services",
    title: "Services",
    items: [
      {
        n: "01",
        name: "3D Modeling",
        desc: "Creación de objetos, personajes y entornos detallados según las necesidades de cada cliente.",
      },
      {
        n: "02",
        name: "Rendering",
        desc: "Renders fotorrealistas con luz, texturas y materiales custom — calidad de cinematógrafo.",
      },
      {
        n: "03",
        name: "Motion Design",
        desc: "Animaciones y motion graphics que aportan energía y narrativa a marcas y productos.",
      },
      {
        n: "04",
        name: "Branding",
        desc: "Identidades visuales coherentes — del logo al sistema de marca completo.",
      },
      {
        n: "05",
        name: "Web Design",
        desc: "Webs limpias, modernas y orientadas a conversión.",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
    {
      key: "items",
      label: "Servicios",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "n", label: "Número (01..)", kind: "text" },
        { key: "name", label: "Nombre", kind: "text" },
        { key: "desc", label: "Descripción", kind: "longtext" },
      ],
      itemDefault: { n: "01", name: "Servicio", desc: "Descripción del servicio." },
    },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default("services"),
      title: z.string().max(120).default(""),
      items: z
        .array(
          z.object({
            n: z.string().max(8).default("01"),
            name: z.string().max(120).default(""),
            desc: z.string().max(500).default(""),
          }),
        )
        .default([]),
    })
    .partial(),
};

const JACK_PROJECTS_SPEC: BlockSpec = {
  kind: "tpl-jack-projects",
  label: "Jack · Sticky projects",
  icon: "Layers",
  group: "Plantillas",
  description: "3 cards proyecto con sticky stack scroll, border-2, grid 2/3, zoom + lightbox.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "projects",
    title: "Project",
    items: [
      {
        number: "01",
        category: "Cliente",
        name: "Nextlevel Studio",
        liveButtonText: "Live Project",
        img1: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055344_5eff02e0-87a5-41ce-b64f-eb08da8f33db.png&w=1280&q=85",
        img2: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055431_11d841fd-8b41-46a5-82e4-b04f2407a7d8.png&w=1280&q=85",
        img3: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055451_e317bf2d-28d4-48cc-86b0-6f72f25b6327.png&w=1280&q=85",
      },
      {
        number: "02",
        category: "Personal",
        name: "Aura Brand Identity",
        liveButtonText: "Live Project",
        img1: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055654_911201c5-36d9-4bc6-bac7-331adfce159f.png&w=1280&q=85",
        img2: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055723_5ceda0b8-d9c2-4665-b2e3-83ba19ba76d1.png&w=1280&q=85",
        img3: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055753_adc5dcbd-a8e6-49c0-b43a-9b030d835cea.png&w=1280&q=85",
      },
      {
        number: "03",
        category: "Cliente",
        name: "Solaris Digital",
        liveButtonText: "Live Project",
        img1: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055759_963cfb0b-4bd1-4b0f-9d0a-09bd6cf95b2f.png&w=1280&q=85",
        img2: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_060108_438f781a-9846-4dcc-89ab-c4e6cb830f5b.png&w=1280&q=85",
        img3: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055818_9d062121-ad7e-46b9-999a-1a6a692ef1ee.png&w=1280&q=85",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
    {
      key: "items",
      label: "Proyectos",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "number", label: "Número (01..)", kind: "text" },
        { key: "category", label: "Categoría", kind: "text" },
        { key: "name", label: "Nombre", kind: "text" },
        { key: "liveButtonText", label: "Texto botón", kind: "text" },
        { key: "img1", label: "Imagen 1 (col1 top)", kind: "url" },
        { key: "img2", label: "Imagen 2 (col1 bottom)", kind: "url" },
        { key: "img3", label: "Imagen 3 (col2 tall)", kind: "url" },
      ],
      itemDefault: {
        number: "01",
        category: "Cliente",
        name: "Proyecto",
        liveButtonText: "Live Project",
        img1: "",
        img2: "",
        img3: "",
      },
    },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default("projects"),
      title: z.string().max(120).default(""),
      items: z
        .array(
          z.object({
            number: z.string().max(8).default("01"),
            category: z.string().max(60).default(""),
            name: z.string().max(120).default(""),
            liveButtonText: z.string().max(40).default("Live Project"),
            img1: httpImgUrl,
            img2: httpImgUrl,
            img3: httpImgUrl,
          }),
        )
        .default([]),
    })
    .partial(),
};

const JACK_CTA: BlockSpec = {
  kind: "tpl-jack-cta",
  label: "Jack · CTA Let's build",
  icon: "Megaphone",
  group: "Plantillas",
  description: "CTA centrado con headline gradient + ContactPill + copyright.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "contact",
    title: "Let's build something",
    body: "Cuéntame en qué estás trabajando. Respondo en menos de 24 horas con una propuesta clara.",
    contactText: "Contact Me",
    contactHref: "mailto:hi@jack.dev",
    copyright: "© 2026 Jack — 3D Creator. Hecho con cariño en Barcelona.",
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "body", label: "Subtexto", kind: "longtext", group: "Contenido" },
    { key: "contactText", label: "Texto botón", kind: "text", group: "Contenido" },
    { key: "contactHref", label: "URL botón", kind: "url", group: "Contenido" },
    { key: "copyright", label: "Copyright", kind: "text", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default("contact"),
      title: z.string().max(120).default(""),
      body: z.string().max(400).default(""),
      contactText: z.string().max(40).default(""),
      contactHref: safeUrlSchema.default("#"),
      copyright: z.string().max(200).default(""),
    })
    .partial(),
};

// ============================================================
// Plantilla 3 — Michael Smith Editorial Dark (`agency-spotlight`)
// ============================================================

const MICHAEL_HERO: BlockSpec = {
  kind: "tpl-michael-hero",
  label: "Michael · Hero loading + cycle",
  icon: "Sparkles",
  group: "Plantillas",
  description:
    "Hero con loading screen contador, video bg, glass nav-pill y rol cycling editorial.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    showLoading: true,
    loadingWords: ["Diseña", "Crea", "Inspira"],
    loadingDurationMs: 2400,
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4",
    navInitials: "MS",
    navItems: [
      { label: "Inicio", href: "#hero" },
      { label: "Trabajos", href: "#trabajos" },
      { label: "CV", href: "#cv" },
    ],
    navCtaText: "Saluda",
    navCtaHref: "#say-hi",
    eyebrow: "Colección '26",
    title: "Michael Smith",
    preCycleText: "Un",
    cycleWords: ["Creativo", "Fullstack", "Founder", "Becario"],
    cycleIntervalMs: 2200,
    postCycleText: "que vive en Madrid.",
    description:
      "Diseñando interacciones digitales fluidas — encontrando los matices que hacen que un sistema cobre vida.",
    primaryButtonText: "Ver trabajos",
    secondaryButtonText: "Hablemos",
    scrollLabel: "Scroll",
  },
  propsSpec: [
    { key: "title", label: "Nombre / Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "preCycleText", label: "Texto antes del rol", kind: "text", group: "Contenido" },
    { key: "postCycleText", label: "Texto después del rol", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "primaryButtonText", label: "Botón primario", kind: "text", group: "Contenido" },
    { key: "secondaryButtonText", label: "Botón secundario", kind: "text", group: "Contenido" },
    { key: "videoUrl", label: "Vídeo de fondo (mp4)", kind: "url", group: "Contenido" },
    { key: "navInitials", label: "Iniciales logo nav", kind: "text", group: "Contenido" },
    { key: "navCtaText", label: "Nav CTA texto", kind: "text", group: "Contenido" },
    { key: "navCtaHref", label: "Nav CTA URL", kind: "url", group: "Contenido" },
    { key: "scrollLabel", label: "Etiqueta scroll", kind: "text", group: "Contenido" },
    { key: "showLoading", label: "Mostrar loading screen", kind: "boolean", group: "Estilo" },
    { key: "loadingDurationMs", label: "Loading duración (ms)", kind: "number", group: "Estilo" },
    { key: "cycleIntervalMs", label: "Cycle interval (ms)", kind: "number", group: "Estilo" },
    {
      key: "navItems",
      label: "Nav links",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Texto", kind: "text" },
        { key: "href", label: "URL", kind: "url" },
      ],
      itemDefault: { label: "Item", href: "#" },
    },
    {
      key: "loadingWords",
      label: "Palabras del loading",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "label", label: "Palabra", kind: "text" }],
      itemDefault: { label: "Palabra" },
    },
    {
      key: "cycleWords",
      label: "Roles que rotan",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "label", label: "Rol", kind: "text" }],
      itemDefault: { label: "Rol" },
    },
  ],
  propsSchema: z
    .object({
      showLoading: z.boolean().default(true),
      loadingWords: z
        .union([z.array(z.string()), z.array(z.object({ label: z.string() }))])
        .default([]),
      loadingDurationMs: z.coerce.number().int().min(800).max(10000).default(2400),
      videoUrl: httpVideoUrl,
      navInitials: z.string().max(4).default(""),
      navItems: z.array(linkItemZ).default([]),
      navCtaText: z.string().max(40).default(""),
      navCtaHref: safeUrlSchema.default("#"),
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(120).default(""),
      preCycleText: z.string().max(60).default(""),
      cycleWords: z
        .union([z.array(z.string()), z.array(z.object({ label: z.string() }))])
        .default([]),
      cycleIntervalMs: z.coerce.number().int().min(500).max(10000).default(2200),
      postCycleText: z.string().max(120).default(""),
      description: z.string().max(400).default(""),
      primaryButtonText: z.string().max(40).default(""),
      secondaryButtonText: z.string().max(40).default(""),
      scrollLabel: z.string().max(20).default(""),
    })
    .partial(),
};

const MICHAEL_BENTO: BlockSpec = {
  kind: "tpl-michael-bento",
  label: "Michael · Bento 4 trabajos",
  icon: "LayoutGrid",
  group: "Plantillas",
  description: "Bento grid 4 cards asimétrico (7/5/5/7) con halftone overlay y hover label.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "trabajos",
    eyebrow: "Trabajos seleccionados",
    title: "Proyectos *recientes*",
    description:
      "Una selección curada de proyectos en los que he trabajado, del concepto al lanzamiento.",
    ctaText: "Ver todo",
    ctaHref: "#all",
    items: [
      {
        title: "Branding Automoción",
        img: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&h=900&fit=crop&q=80",
        span: "md:col-span-7",
        aspect: "aspect-[16/10]",
      },
      {
        title: "Arquitectura urbana",
        img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&h=900&fit=crop&q=80",
        span: "md:col-span-5",
        aspect: "aspect-[4/5]",
      },
      {
        title: "Perspectiva humana",
        img: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1200&h=900&fit=crop&q=80",
        span: "md:col-span-5",
        aspect: "aspect-[4/5]",
      },
      {
        title: "Identidad de marca",
        img: "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=1200&h=900&fit=crop&q=80",
        span: "md:col-span-7",
        aspect: "aspect-[16/10]",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título (admite *italic*)", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "ctaText", label: "CTA texto", kind: "text", group: "Contenido" },
    { key: "ctaHref", label: "CTA URL", kind: "url", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
    {
      key: "items",
      label: "Cards bento",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "title", label: "Título", kind: "text" },
        { key: "img", label: "Imagen", kind: "url" },
        {
          key: "span",
          label: "Span (md:col-span-7 | md:col-span-5)",
          kind: "text",
        },
        {
          key: "aspect",
          label: "Aspecto (aspect-[16/10] | aspect-[4/5])",
          kind: "text",
        },
      ],
      itemDefault: {
        title: "Proyecto",
        img: "",
        span: "md:col-span-6",
        aspect: "aspect-[16/10]",
      },
    },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default(""),
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      description: z.string().max(400).default(""),
      ctaText: z.string().max(40).default(""),
      ctaHref: safeUrlSchema.default("#"),
      items: z
        .array(
          z.object({
            title: z.string().max(120).default(""),
            img: httpImgUrl,
            span: z.string().max(40).default("md:col-span-6"),
            aspect: z.string().max(40).default("aspect-[16/10]"),
          }),
        )
        .default([]),
    })
    .partial(),
};

const MICHAEL_JOURNAL: BlockSpec = {
  kind: "tpl-michael-journal",
  label: "Michael · Journal pills",
  icon: "FileText",
  group: "Plantillas",
  description: "Lista de entradas tipo pill horizontal con thumbnail circular, minutos y fecha.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Diario",
    title: "Notas *recientes*",
    ctaText: "Ver todo",
    ctaHref: "#blog",
    items: [
      {
        title: "Por qué los detalles ganan a la escala",
        minutes: "8 min",
        date: "12 Mar",
        img: "https://images.unsplash.com/photo-1542435503-956c469947f6?w=240&h=240&fit=crop&q=80",
      },
      {
        title: "Construir interfaces con presencia, no peso",
        minutes: "5 min",
        date: "01 Mar",
        img: "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=240&h=240&fit=crop&q=80",
      },
      {
        title: "El silencio en el diseño es información",
        minutes: "11 min",
        date: "18 Feb",
        img: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=240&h=240&fit=crop&q=80",
      },
      {
        title: "Notas sobre intuición y datos",
        minutes: "6 min",
        date: "02 Feb",
        img: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=240&h=240&fit=crop&q=80",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título (admite *italic*)", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "ctaText", label: "CTA texto", kind: "text", group: "Contenido" },
    { key: "ctaHref", label: "CTA URL", kind: "url", group: "Contenido" },
    {
      key: "items",
      label: "Entradas",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "title", label: "Título", kind: "text" },
        { key: "minutes", label: "Minutos lectura", kind: "text" },
        { key: "date", label: "Fecha", kind: "text" },
        { key: "img", label: "Thumb", kind: "url" },
      ],
      itemDefault: { title: "", minutes: "5 min", date: "01 Ene", img: "" },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      ctaText: z.string().max(40).default(""),
      ctaHref: safeUrlSchema.default("#"),
      items: z
        .array(
          z.object({
            title: z.string().max(160).default(""),
            minutes: z.string().max(20).default(""),
            date: z.string().max(20).default(""),
            img: httpImgUrl,
          }),
        )
        .default([]),
    })
    .partial(),
};

const MICHAEL_EXPLORATIONS: BlockSpec = {
  kind: "tpl-michael-explorations",
  label: "Michael · Parallax explorations",
  icon: "Columns2",
  group: "Plantillas",
  description: "2 columnas con scroll-driven parallax (factor opuesto), imágenes rotadas alternas.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Exploraciones",
    title: "Patio *visual*",
    description:
      "Pruebas, bocetos y experimentos que aún no son proyectos pero ya tienen vida propia.",
    images: [
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=800&fit=crop&q=80",
      "https://images.unsplash.com/photo-1493723843671-1d655e66ac1c?w=800&h=800&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=800&h=800&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=800&fit=crop&q=80",
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=800&fit=crop&q=80",
      "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=800&fit=crop&q=80",
    ],
    splitAt: 3,
    factorLeft: -0.25,
    factorRight: 0.2,
  },
  propsSpec: [
    { key: "title", label: "Título (admite *italic*)", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "splitAt", label: "Items en columna izq", kind: "number", group: "Layout" },
    { key: "factorLeft", label: "Parallax factor izq", kind: "number", group: "Avanzado" },
    { key: "factorRight", label: "Parallax factor der", kind: "number", group: "Avanzado" },
    {
      key: "images",
      label: "Imágenes",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "src", label: "URL", kind: "url" }],
      itemDefault: { src: "" },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      description: z.string().max(400).default(""),
      images: z.union([z.array(httpImgUrl), z.array(z.object({ src: httpImgUrl }))]).default([]),
      splitAt: z.coerce.number().int().min(1).max(20).default(3),
      factorLeft: z.coerce.number().min(-1).max(1).default(-0.25),
      factorRight: z.coerce.number().min(-1).max(1).default(0.2),
    })
    .partial(),
};

const MICHAEL_STATS: BlockSpec = {
  kind: "tpl-michael-stats",
  label: "Michael · Stats 3-col",
  icon: "BarChart3",
  group: "Plantillas",
  description: "3 stats centradas con valor display gigante + label tracking-widest.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    items: [
      { value: "08+", label: "años de experiencia" },
      { value: "120+", label: "proyectos entregados" },
      { value: "98%", label: "clientes satisfechos" },
    ],
  },
  propsSpec: [
    {
      key: "items",
      label: "Stats",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "value", label: "Valor", kind: "text" },
        { key: "label", label: "Etiqueta", kind: "text" },
      ],
      itemDefault: { value: "0+", label: "Stat" },
    },
  ],
  propsSchema: z
    .object({
      items: z
        .array(
          z.object({
            value: z.string().max(20).default(""),
            label: z.string().max(80).default(""),
          }),
        )
        .default([]),
    })
    .partial(),
};

const MICHAEL_CONTACT_FOOTER: BlockSpec = {
  kind: "tpl-michael-contact-footer",
  label: "Michael · Contact + footer marquee",
  icon: "MessageSquare",
  group: "Plantillas",
  description:
    "Vídeo bg flipped + marquee gigante editorial + email pill + footer con socials, status y copyright.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "say-hi",
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4",
    marqueeText: "Diseñando el futuro •",
    marqueeIterations: 14,
    marqueeDuration: 50,
    eyebrow: "Contacto",
    title: "Construyamos algo memorable",
    emailLabel: "hola@michaelsmith.com",
    emailHref: "mailto:hola@michaelsmith.com",
    socials: ["twitter", "linkedin", "github", "messageCircle"],
    statusText: "Disponible para proyectos",
    copyright: "© 2026 Michael Smith",
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "marqueeText", label: "Texto marquee", kind: "text", group: "Contenido" },
    { key: "marqueeIterations", label: "Repeticiones marquee", kind: "number", group: "Estilo" },
    { key: "marqueeDuration", label: "Duración marquee (s)", kind: "number", group: "Estilo" },
    { key: "emailLabel", label: "Email visible", kind: "text", group: "Contenido" },
    { key: "emailHref", label: "Email href", kind: "url", group: "Contenido" },
    { key: "videoUrl", label: "Vídeo bg", kind: "url", group: "Contenido" },
    { key: "statusText", label: "Status (badge verde)", kind: "text", group: "Contenido" },
    { key: "copyright", label: "Copyright", kind: "text", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
    {
      key: "socials",
      label: "Iconos sociales (twitter|linkedin|github|messageCircle)",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "key", label: "Icono", kind: "text" }],
      itemDefault: { key: "twitter" },
    },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default(""),
      videoUrl: httpVideoUrl,
      marqueeText: z.string().max(80).default(""),
      marqueeIterations: z.coerce.number().int().min(2).max(30).default(14),
      marqueeDuration: z.coerce.number().int().min(10).max(200).default(50),
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      emailLabel: z.string().max(120).default(""),
      emailHref: safeUrlSchema.default("#"),
      socials: z
        .union([
          z.array(z.enum(["twitter", "linkedin", "github", "messageCircle"])),
          z.array(z.object({ key: z.enum(["twitter", "linkedin", "github", "messageCircle"]) })),
        ])
        .default([]),
      statusText: z.string().max(120).default(""),
      copyright: z.string().max(200).default(""),
    })
    .partial(),
};

// ============================================================
// Plantilla 4 — Mint Pre-Launch (`coming-soon-typewriter`)
// ============================================================

const MINT_HERO: BlockSpec = {
  kind: "tpl-mint-hero",
  label: "Mint · Hero countdown",
  icon: "Hourglass",
  group: "Plantillas",
  description:
    "Hero pre-launch con vídeo bg, badge mint, h1 gradient italic, countdown live, email capture y disclaimer.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    logoLabel: "terra",
    notifyButtonText: "Avísame al lanzar",
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4",
    badge: "✦ Q2 2026 · early access",
    titleHtml: "Algo grande está <em>cocinándose</em>.",
    description:
      "Suscríbete y serás de los primeros en saberlo. Sin spam — solo el aviso del lanzamiento.",
    targetDate: "2026-08-15T10:00:00Z",
    countdownLabels: { days: "días", hours: "horas", minutes: "min", seconds: "seg" },
    emailPlaceholder: "tu@email.com",
    successMessage: "✓ Recibido — te avisaremos en cuanto abramos.",
    disclaimer: "· 1.420 personas ya en la lista · sin spam · cancela en 1 click ·",
  },
  propsSpec: [
    { key: "logoLabel", label: "Logo (texto)", kind: "text", group: "Contenido" },
    { key: "notifyButtonText", label: "Botón notificación nav", kind: "text", group: "Contenido" },
    { key: "badge", label: "Badge", kind: "text", group: "Contenido" },
    { key: "titleHtml", label: "Título (admite <em>)", kind: "longtext", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    {
      key: "targetDate",
      label: "Fecha lanzamiento (ISO, vacío = sin countdown)",
      kind: "text",
      group: "Contenido",
    },
    { key: "emailPlaceholder", label: "Placeholder email", kind: "text", group: "Contenido" },
    { key: "successMessage", label: "Mensaje éxito", kind: "text", group: "Contenido" },
    { key: "disclaimer", label: "Disclaimer pequeño", kind: "longtext", group: "Contenido" },
    { key: "videoUrl", label: "Vídeo bg", kind: "url", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      logoLabel: z.string().max(40).default(""),
      notifyButtonText: z.string().max(40).default(""),
      videoUrl: httpVideoUrl,
      badge: z.string().max(80).default(""),
      titleHtml: z.string().max(200).default(""),
      description: z.string().max(400).default(""),
      targetDate: z.string().max(40).default(""),
      countdownLabels: z
        .object({
          days: z.string().max(20).default("días"),
          hours: z.string().max(20).default("horas"),
          minutes: z.string().max(20).default("min"),
          seconds: z.string().max(20).default("seg"),
        })
        .partial()
        .default({}),
      emailPlaceholder: z.string().max(80).default(""),
      successMessage: z.string().max(200).default(""),
      disclaimer: z.string().max(200).default(""),
    })
    .partial(),
};

const MINT_PERKS: BlockSpec = {
  kind: "tpl-mint-perks",
  label: "Mint · Perks 3-col",
  icon: "Sparkles",
  group: "Plantillas",
  description: "3 cards perks con icono lucide, título y descripción sobre fondo gradient mint.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Lo que estamos construyendo",
    title: "Hecho para personas que valoran el detalle.",
    perks: [
      {
        icon: "Zap",
        title: "10× más rápido",
        desc: "Renderizado con cache inteligente y edge runtime.",
      },
      {
        icon: "Sparkles",
        title: "Sin curva",
        desc: "Diseñado para que entres al toque, sin onboarding.",
      },
      {
        icon: "Heart",
        title: "Con cariño",
        desc: "Pequeño equipo, mantenido en abierto, escuchando feedback.",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    {
      key: "perks",
      label: "Perks",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "icon", label: "Icono lucide", kind: "icon" },
        { key: "title", label: "Título", kind: "text" },
        { key: "desc", label: "Descripción", kind: "longtext" },
      ],
      itemDefault: { icon: "Sparkles", title: "Perk", desc: "Descripción." },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      perks: z
        .array(
          z.object({
            icon: z.string().max(40).default("Sparkles"),
            title: z.string().max(80).default(""),
            desc: z.string().max(300).default(""),
          }),
        )
        .default([]),
    })
    .partial(),
};

const MINT_ROADMAP: BlockSpec = {
  kind: "tpl-mint-roadmap",
  label: "Mint · Roadmap timeline",
  icon: "Milestone",
  group: "Plantillas",
  description: "Timeline horizontal con badges Listo/Próximamente.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Roadmap",
    title: "De aquí al lanzamiento",
    items: [
      { date: "Q1 2026", label: "Closed alpha · 50 usuarios", done: true },
      { date: "Q2 2026", label: "Public beta · sin lista de espera", done: true },
      { date: "Q3 2026", label: "Lanzamiento general", done: false },
      { date: "Q4 2026", label: "Plan empresa + SSO", done: false },
    ],
    doneLabel: "Listo",
    pendingLabel: "Próximamente",
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "doneLabel", label: "Etiqueta 'completado'", kind: "text", group: "Contenido" },
    { key: "pendingLabel", label: "Etiqueta 'pendiente'", kind: "text", group: "Contenido" },
    {
      key: "items",
      label: "Milestones",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "date", label: "Fecha (Q1 2026)", kind: "text" },
        { key: "label", label: "Descripción", kind: "text" },
        { key: "done", label: "Completado", kind: "boolean" },
      ],
      itemDefault: { date: "Q1 2026", label: "Milestone", done: false },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      doneLabel: z.string().max(40).default(""),
      pendingLabel: z.string().max(40).default(""),
      items: z
        .array(
          z.object({
            date: z.string().max(40).default(""),
            label: z.string().max(160).default(""),
            done: z.boolean().default(false),
          }),
        )
        .default([]),
    })
    .partial(),
};

// ============================================================
// Plantilla 5 — Nimbus / Power AI (`docs-aurora`)
// ============================================================

const NIMBUS_HERO: BlockSpec = {
  kind: "tpl-nimbus-hero",
  label: "Nimbus · Hero gradient AI",
  icon: "Sparkles",
  group: "Plantillas",
  description:
    "Hero docs/AI con vídeo bg, h1 'Power AI' gradient indigo→purple→amber, logo marquee.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    brand: "nimbus",
    navItems: [
      { label: "Producto", href: "#producto", chevron: true },
      { label: "Soluciones", href: "#soluciones" },
      { label: "Precios", href: "#precios" },
      { label: "Aprende", href: "#aprende", chevron: true },
    ],
    loginText: "Iniciar sesión",
    signupText: "Crear cuenta",
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4",
    titleHtml: "Power <em>AI</em>",
    description: "La IA más potente jamás desplegada — para tus equipos, productos y procesos.",
    ctaText: "Probar gratis →",
    marqueeLabel: "Confiado por equipos\nen todo el mundo",
    logos: ["Vortex", "Nimbus", "Prysma", "Cirrus", "Kynder", "Halcyn"],
  },
  propsSpec: [
    { key: "brand", label: "Marca (logo texto)", kind: "text", group: "Contenido" },
    { key: "titleHtml", label: "Título (admite <em> gradient)", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "ctaText", label: "CTA texto", kind: "text", group: "Contenido" },
    { key: "loginText", label: "Login nav", kind: "text", group: "Contenido" },
    { key: "signupText", label: "Signup nav", kind: "text", group: "Contenido" },
    { key: "videoUrl", label: "Vídeo bg", kind: "url", group: "Contenido" },
    { key: "marqueeLabel", label: "Texto antes del marquee", kind: "longtext", group: "Contenido" },
    {
      key: "navItems",
      label: "Nav links",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Texto", kind: "text" },
        { key: "href", label: "URL", kind: "url" },
        { key: "chevron", label: "Mostrar chevron", kind: "boolean" },
      ],
      itemDefault: { label: "Item", href: "#", chevron: false },
    },
    {
      key: "logos",
      label: "Logos marquee (texto)",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "label", label: "Nombre marca", kind: "text" }],
      itemDefault: { label: "Marca" },
    },
  ],
  propsSchema: z
    .object({
      brand: z.string().max(40).default(""),
      navItems: z
        .array(
          z.object({
            label: z.string().default(""),
            href: safeUrlSchema.default("#"),
            chevron: z.boolean().default(false),
          }),
        )
        .default([]),
      loginText: z.string().max(40).default(""),
      signupText: z.string().max(40).default(""),
      videoUrl: httpVideoUrl,
      titleHtml: z.string().max(200).default(""),
      description: z.string().max(400).default(""),
      ctaText: z.string().max(60).default(""),
      marqueeLabel: z.string().max(160).default(""),
      logos: z.union([z.array(z.string()), z.array(z.object({ label: z.string() }))]).default([]),
    })
    .partial(),
};

const NIMBUS_DOCS_GRID: BlockSpec = {
  kind: "tpl-nimbus-docs-grid",
  label: "Nimbus · Docs grid 6",
  icon: "BookOpen",
  group: "Plantillas",
  description: "Grid 6 cards docs (lucide icon + título + desc + link) con orb gradient en hover.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "aprende",
    eyebrow: "Documentación",
    title: "Todo lo que necesitas saber",
    description:
      "Guías, ejemplos y referencias mantenidas por el equipo. Sin paywalls — todo abierto.",
    items: [
      {
        icon: "Terminal",
        title: "Quick start",
        desc: "De cero a producción en 5 minutos. Una sola línea para instalar el SDK.",
        href: "#qs",
      },
      {
        icon: "Code2",
        title: "API Reference",
        desc: "Documentación completa con ejemplos en TypeScript, Python, Go y curl.",
        href: "#api",
      },
      {
        icon: "FileText",
        title: "Guías",
        desc: "Tutoriales paso a paso para los flujos más comunes — sin saltarse nada.",
        href: "#guides",
      },
      {
        icon: "Sparkles",
        title: "Recetas",
        desc: "Snippets curados para casos reales: streaming, batching, retries, etc.",
        href: "#recipes",
      },
      {
        icon: "Github",
        title: "Open source",
        desc: "Cliente de referencia en GitHub. PRs y discusiones bienvenidas.",
        href: "#oss",
      },
      {
        icon: "ChevronDown",
        title: "Changelog",
        desc: "Cada release documentada — qué cambió, qué falta, qué viene.",
        href: "#changelog",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
    {
      key: "items",
      label: "Cards docs",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "icon", label: "Icono lucide", kind: "icon" },
        { key: "title", label: "Título", kind: "text" },
        { key: "desc", label: "Descripción", kind: "longtext" },
        { key: "href", label: "URL", kind: "url" },
      ],
      itemDefault: { icon: "FileText", title: "Doc", desc: "Descripción.", href: "#" },
    },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default(""),
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      description: z.string().max(400).default(""),
      items: z
        .array(
          z.object({
            icon: z.string().max(40).default("FileText"),
            title: z.string().max(80).default(""),
            desc: z.string().max(300).default(""),
            href: safeUrlSchema.default("#"),
          }),
        )
        .default([]),
    })
    .partial(),
};

const NIMBUS_QUICK_START: BlockSpec = {
  kind: "tpl-nimbus-quick-start",
  label: "Nimbus · Quick start split",
  icon: "Code2",
  group: "Plantillas",
  description: "Split 2-col: pasos a la izquierda, code sample con macOS chrome a la derecha.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Quick start",
    title: "5 minutos. Producción.",
    description:
      "Instala el SDK con un comando, configura tu API key, lanza tu primera petición. Sin más.",
    steps: [
      "1. npm install @nimbus/sdk",
      "2. Genera tu API key en /admin/keys",
      "3. Copia el snippet de la derecha",
      "4. Stream tu primera respuesta",
    ],
    codeFilename: "stream.ts",
    code: `import { Nimbus } from "@nimbus/sdk";

const client = new Nimbus({ apiKey: process.env.NIMBUS_KEY });

const result = await client.completions.create({
  model: "nimbus-1.5",
  prompt: "Crea un plan de marketing para una marca DTC.",
  stream: true,
});

for await (const chunk of result) {
  process.stdout.write(chunk.text);
}`,
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "codeFilename", label: "Filename code (chrome)", kind: "text", group: "Contenido" },
    { key: "code", label: "Code sample", kind: "longtext", group: "Contenido" },
    {
      key: "steps",
      label: "Pasos",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "label", label: "Paso", kind: "text" }],
      itemDefault: { label: "1. Paso" },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      description: z.string().max(400).default(""),
      steps: z.union([z.array(z.string()), z.array(z.object({ label: z.string() }))]).default([]),
      codeFilename: z.string().max(60).default(""),
      code: z.string().max(4000).default(""),
    })
    .partial(),
};

const NIMBUS_COMMUNITY: BlockSpec = {
  kind: "tpl-nimbus-community",
  label: "Nimbus · Community CTA",
  icon: "Users",
  group: "Plantillas",
  description: "CTA Discord centrado con eyebrow + h2 + description + glass button.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Comunidad",
    title: "8.000 desarrolladores activos en Discord.",
    description: "Encuentra respuestas en minutos. Sé de los primeros en enterarte de lo nuevo.",
    buttonText: "Únete a Discord →",
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "buttonText", label: "Botón texto", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(200).default(""),
      description: z.string().max(400).default(""),
      buttonText: z.string().max(60).default(""),
    })
    .partial(),
};

// ============================================================
// Plantilla 6 — Securify+Targo B2B Dark (`launch-marquee`)
// ============================================================

const SECURIFY_HERO: BlockSpec = {
  kind: "tpl-securify-hero",
  label: "Securify · Hero staggered + stats",
  icon: "ShieldCheck",
  group: "Plantillas",
  description:
    "Hero B2B con vídeo bg, navbar pill, headline staggered en posiciones absolutas, 3 stats, glass widget consultoría.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    brand: "securify",
    navItems: [
      { label: "Plataforma", href: "#plataforma" },
      { label: "Soluciones", href: "#soluciones" },
      { label: "Compañía", href: "#compania" },
      { label: "Soporte", href: "#soporte" },
    ],
    ctaText: "empezar →",
    videoUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_063509_7d167302-4fd4-480b-8260-18ab572333d4.mp4",
    staggeredWords: [
      { text: "protege", position: "absolute left-4 top-[18%] md:left-10" },
      { text: "tus", position: "absolute right-4 top-[36%] md:right-10" },
      { text: "datos", position: "absolute left-[18%] top-[56%] md:left-[28%]" },
    ],
    description:
      "guardamos tu información con el máximo cuidado y te damos privacidad en cada paso.",
    descriptionPosition: "absolute left-6 top-[44%] z-10 max-w-[280px] md:left-10",
    stats: [
      {
        value: "+65k",
        label: "startups confían",
        position: "absolute right-6 top-[14%] md:right-24",
        divisor: "left",
      },
      {
        value: "+1.5b",
        label: "gb de datos protegidos",
        position: "absolute left-6 bottom-20 md:left-20 md:bottom-24",
        divisor: "right",
      },
      {
        value: "+300k",
        label: "descargas",
        position: "absolute right-6 bottom-16 md:right-20 md:bottom-20",
        divisor: "left",
        alignRight: true,
      },
    ],
    widgetEyebrow: "consulta gratis",
    widgetText: "30 min con un experto en seguridad — auditoría rápida.",
    widgetButtonText: "Reservar llamada",
  },
  propsSpec: [
    { key: "brand", label: "Marca", kind: "text", group: "Contenido" },
    { key: "ctaText", label: "CTA nav", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción central", kind: "longtext", group: "Contenido" },
    { key: "videoUrl", label: "Vídeo bg", kind: "url", group: "Contenido" },
    { key: "widgetEyebrow", label: "Widget eyebrow", kind: "text", group: "Contenido" },
    { key: "widgetText", label: "Widget texto", kind: "longtext", group: "Contenido" },
    { key: "widgetButtonText", label: "Widget botón", kind: "text", group: "Contenido" },
    {
      key: "navItems",
      label: "Nav links",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Texto", kind: "text" },
        { key: "href", label: "URL", kind: "url" },
      ],
      itemDefault: { label: "Item", href: "#" },
    },
    {
      key: "staggeredWords",
      label: "Palabras gigantes (staggered)",
      kind: "items",
      group: "Contenido",
      description: "Cada palabra absolutely-positioned. Editar position con clases tailwind.",
      itemSpec: [
        { key: "text", label: "Texto", kind: "text" },
        { key: "position", label: "Posición Tailwind", kind: "text" },
      ],
      itemDefault: { text: "palabra", position: "absolute left-10 top-[40%]" },
    },
    {
      key: "stats",
      label: "Stats absolutas",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "value", label: "Valor", kind: "text" },
        { key: "label", label: "Etiqueta", kind: "text" },
        { key: "position", label: "Posición tailwind", kind: "text" },
        { key: "divisor", label: "Divisor (left|right)", kind: "text" },
        { key: "alignRight", label: "Align right", kind: "boolean" },
      ],
      itemDefault: {
        value: "+0k",
        label: "stat",
        position: "absolute right-10 top-[20%]",
        divisor: "left",
        alignRight: false,
      },
    },
  ],
  propsSchema: z
    .object({
      brand: z.string().max(40).default(""),
      navItems: z.array(linkItemZ).default([]),
      ctaText: z.string().max(40).default(""),
      videoUrl: httpVideoUrl,
      staggeredWords: z
        .array(
          z.object({
            text: z.string().max(40).default(""),
            position: z.string().max(200).default(""),
          }),
        )
        .default([]),
      description: z.string().max(400).default(""),
      descriptionPosition: z.string().max(200).default(""),
      stats: z
        .array(
          z.object({
            value: z.string().max(20).default(""),
            label: z.string().max(80).default(""),
            position: z.string().max(200).default(""),
            divisor: z.enum(["left", "right"]).default("left"),
            alignRight: z.boolean().default(false),
          }),
        )
        .default([]),
      widgetEyebrow: z.string().max(80).default(""),
      widgetText: z.string().max(300).default(""),
      widgetButtonText: z.string().max(40).default(""),
    })
    .partial(),
};

const SECURITY_SECTORS: BlockSpec = {
  kind: "tpl-security-sectors",
  label: "Securify · Sectors marquee",
  icon: "Layers",
  group: "Plantillas",
  description: "Marquee horizontal autoplay de sectores con dot separator.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Implantado en",
    sectors: [
      "FinTech",
      "Sanidad",
      "Retail",
      "Logística",
      "Educación",
      "Gov",
      "Energía",
      "Industria",
    ],
    duration: 30,
  },
  propsSpec: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "duration", label: "Duración loop (s)", kind: "number", group: "Estilo" },
    {
      key: "sectors",
      label: "Sectores",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "label", label: "Sector", kind: "text" }],
      itemDefault: { label: "Sector" },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      sectors: z.union([z.array(z.string()), z.array(z.object({ label: z.string() }))]).default([]),
      duration: z.coerce.number().int().min(10).max(120).default(30),
    })
    .partial(),
};

const SECURITY_PILLARS: BlockSpec = {
  kind: "tpl-security-pillars",
  label: "Securify · 3 pillars grid",
  icon: "Columns3",
  group: "Plantillas",
  description: "3 pillars en grid con separator 1px (gap-px), número 01..03.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "Pilares",
    title: "seguridad sin compromisos.",
    description:
      "Una plataforma diseñada con la convicción de que los datos de tus clientes son sagrados.",
    pillars: [
      {
        n: "01",
        title: "Cifrado en reposo y en tránsito",
        desc: "AES-256, claves rotadas automáticamente, KMS gestionado y mTLS para todos los servicios internos.",
      },
      {
        n: "02",
        title: "Cero confianza por diseño",
        desc: "Cada acción se autentica, autoriza y audita. Roles dinámicos, IP allowlist y MFA obligatorio en producción.",
      },
      {
        n: "03",
        title: "Compliance en serie",
        desc: "ISO 27001, SOC 2 Type II, GDPR y HIPAA — informes en un click para tu equipo legal.",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    {
      key: "pillars",
      label: "Pilares",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "n", label: "Número (01..)", kind: "text" },
        { key: "title", label: "Título", kind: "text" },
        { key: "desc", label: "Descripción", kind: "longtext" },
      ],
      itemDefault: { n: "01", title: "Pilar", desc: "Descripción." },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(160).default(""),
      description: z.string().max(400).default(""),
      pillars: z
        .array(
          z.object({
            n: z.string().max(8).default("01"),
            title: z.string().max(160).default(""),
            desc: z.string().max(500).default(""),
          }),
        )
        .default([]),
    })
    .partial(),
};

const SECURITY_PRICING: BlockSpec = {
  kind: "tpl-security-pricing",
  label: "Securify · B2B 2-tier clipped",
  icon: "BadgeDollarSign",
  group: "Plantillas",
  description: "2-tier (Starter glass + Enterprise highlighted) con clipped corners button.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    anchorId: "precios",
    eyebrow: "Pricing",
    title: "transparente. previsible. sin sorpresas.",
    tiers: [
      {
        label: "Starter",
        price: "0€",
        period: "para empezar",
        features: ["Hasta 5 usuarios", "Cifrado AES-256", "Audit log básico", "Comunidad Discord"],
        buttonText: "Empezar gratis",
      },
      {
        label: "Enterprise",
        price: "12€",
        period: "por usuario / mes",
        features: [
          "Todo Starter +",
          "SSO + SCIM",
          "SOC 2 + ISO 27001 reports",
          "Audit log avanzado + SIEM export",
          "SLA 99.99 + soporte 24/7",
        ],
        buttonText: "Probar 30 días",
        featured: true,
        highlight: "Más popular",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "anchorId", label: "ID ancla", kind: "text", group: "Avanzado" },
    {
      key: "tiers",
      label: "Tiers",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Nombre", kind: "text" },
        { key: "price", label: "Precio", kind: "text" },
        { key: "period", label: "Periodo", kind: "text" },
        {
          key: "features",
          label: "Features (una por línea)",
          kind: "longtext",
        },
        { key: "buttonText", label: "Botón", kind: "text" },
        { key: "featured", label: "Destacado", kind: "boolean" },
        { key: "highlight", label: "Texto badge highlight", kind: "text" },
      ],
      itemDefault: {
        label: "Plan",
        price: "0€",
        period: "/mes",
        features: "feature",
        buttonText: "Elegir",
        featured: false,
        highlight: "",
      },
    },
  ],
  propsSchema: z
    .object({
      anchorId: z.string().max(60).default(""),
      eyebrow: z.string().max(80).default(""),
      title: z.string().max(200).default(""),
      tiers: z
        .array(
          z.object({
            label: z.string().max(60).default(""),
            price: z.string().max(40).default(""),
            period: z.string().max(60).default(""),
            // features: acepta string (longtext con una feature por línea) o string[]
            features: z
              .union([z.string(), z.array(z.string())])
              .transform((v) =>
                typeof v === "string"
                  ? v
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : v,
              )
              .default([]),
            buttonText: z.string().max(40).default(""),
            featured: z.boolean().default(false),
            highlight: z.string().max(40).default(""),
          }),
        )
        .default([]),
    })
    .partial(),
};

const SECURITY_CTA: BlockSpec = {
  kind: "tpl-security-cta",
  label: "Securify · CTA clipped",
  icon: "Megaphone",
  group: "Plantillas",
  description: "CTA centrado con clipped-corner button + copyright compliance.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    title: "empieza a proteger en menos de 10 minutos.",
    description: "Sin tarjeta. Sin onboarding interminable. Sin sorpresas.",
    buttonText: "empezar →",
    copyright: "© 2026 securify. SOC 2 Type II · ISO 27001 · GDPR",
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "buttonText", label: "Botón", kind: "text", group: "Contenido" },
    { key: "copyright", label: "Copyright", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      title: z.string().max(200).default(""),
      description: z.string().max(400).default(""),
      buttonText: z.string().max(40).default(""),
      copyright: z.string().max(200).default(""),
    })
    .partial(),
};

// ============================================================
// Plantilla 7 — Magazine paper editorial (`blog-particles`)
// ============================================================

const MAGAZINE_MASTHEAD: BlockSpec = {
  kind: "tpl-magazine-masthead",
  label: "Magazine · Masthead serif",
  icon: "Newspaper",
  group: "Plantillas",
  description:
    "Top masthead editorial cálido con número, título serif gigante centrado y nav inferior.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    issueNumber: "Núm. 142 · Marzo 2026",
    publicationName: "El Diario",
    subscribeText: "Suscribirme",
    navLinks: ["Inicio", "Producto", "Diseño", "Ingeniería", "Negocio", "Cultura", "Archivo"],
  },
  propsSpec: [
    { key: "publicationName", label: "Nombre publicación", kind: "text", group: "Contenido" },
    { key: "issueNumber", label: "Número/fecha", kind: "text", group: "Contenido" },
    { key: "subscribeText", label: "Botón suscribir", kind: "text", group: "Contenido" },
    {
      key: "navLinks",
      label: "Nav links (texto)",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "label", label: "Sección", kind: "text" }],
      itemDefault: { label: "Sección" },
    },
  ],
  propsSchema: z
    .object({
      issueNumber: z.string().max(80).default(""),
      publicationName: z.string().max(80).default(""),
      subscribeText: z.string().max(40).default(""),
      navLinks: z
        .union([z.array(z.string()), z.array(z.object({ label: z.string() }))])
        .default([]),
    })
    .partial(),
};

const MAGAZINE_FEATURED: BlockSpec = {
  kind: "tpl-magazine-featured",
  label: "Magazine · Featured 8/4",
  icon: "Image",
  group: "Plantillas",
  description:
    "Hero editorial 2-col: featured story (cover + título serif + hook) + sidebar 4 entradas.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    featuredCategory: "Producto · Análisis",
    featuredTitle: "La economía del software pequeño y rentable",
    featuredHook:
      "Por qué la próxima década pertenece a los productos de 2 personas con 50.000€ ARR antes que a los unicornios. Un repaso a los modelos de negocio más interesantes de 2026, con datos, fracasos y un par de vergüenzas ajenas.",
    featuredAuthor: "Edgar Vela",
    featuredMinutes: "8 min",
    featuredDate: "12 mar 2026",
    featuredCover:
      "https://images.unsplash.com/photo-1499914485622-a88fac536970?w=1400&h=900&fit=crop&q=80",
    sidebarLabel: "Esta semana",
    sidebarItems: [
      {
        cat: "Negocio",
        title: "3 lecciones de un fracaso de 200k€",
        author: "Laura Méndez",
        minutes: "6 min",
        cover:
          "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=200&h=200&fit=crop&q=80",
      },
      {
        cat: "Diseño",
        title: "Diseñar para el silencio: por qué menos no es siempre menos",
        author: "Carlos Vega",
        minutes: "4 min",
        cover:
          "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=200&h=200&fit=crop&q=80",
      },
      {
        cat: "Ingeniería",
        title: "Por qué Postgres y nada más en 2026",
        author: "Sara P.",
        minutes: "12 min",
        cover:
          "https://images.unsplash.com/photo-1489875347897-49f64b51c1f8?w=200&h=200&fit=crop&q=80",
      },
      {
        cat: "Cultura",
        title: "Los rituales de equipo que sí funcionan",
        author: "Diego R.",
        minutes: "5 min",
        cover:
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop&q=80",
      },
    ],
  },
  propsSpec: [
    { key: "featuredTitle", label: "Título principal", kind: "text", group: "Contenido" },
    { key: "featuredCategory", label: "Categoría", kind: "text", group: "Contenido" },
    { key: "featuredHook", label: "Hook", kind: "longtext", group: "Contenido" },
    { key: "featuredAuthor", label: "Autor", kind: "text", group: "Contenido" },
    { key: "featuredMinutes", label: "Minutos lectura", kind: "text", group: "Contenido" },
    { key: "featuredDate", label: "Fecha", kind: "text", group: "Contenido" },
    { key: "featuredCover", label: "Cover URL", kind: "url", group: "Contenido" },
    { key: "sidebarLabel", label: "Sidebar label", kind: "text", group: "Contenido" },
    {
      key: "sidebarItems",
      label: "Sidebar items",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "cat", label: "Categoría", kind: "text" },
        { key: "title", label: "Título", kind: "text" },
        { key: "author", label: "Autor", kind: "text" },
        { key: "minutes", label: "Minutos", kind: "text" },
        { key: "cover", label: "Cover", kind: "url" },
      ],
      itemDefault: { cat: "", title: "", author: "", minutes: "5 min", cover: "" },
    },
  ],
  propsSchema: z
    .object({
      featuredCategory: z.string().max(80).default(""),
      featuredTitle: z.string().max(200).default(""),
      featuredHook: z.string().max(600).default(""),
      featuredAuthor: z.string().max(80).default(""),
      featuredMinutes: z.string().max(20).default(""),
      featuredDate: z.string().max(40).default(""),
      featuredCover: httpImgUrl,
      sidebarLabel: z.string().max(80).default(""),
      sidebarItems: z
        .array(
          z.object({
            cat: z.string().max(60).default(""),
            title: z.string().max(160).default(""),
            author: z.string().max(80).default(""),
            minutes: z.string().max(20).default(""),
            cover: httpImgUrl,
          }),
        )
        .default([]),
    })
    .partial(),
};

const MAGAZINE_CATEGORIES: BlockSpec = {
  kind: "tpl-magazine-categories",
  label: "Magazine · Categories grid",
  icon: "LayoutGrid",
  group: "Plantillas",
  description: "Grid 6 categorías sobre fondo dark, con orb gradient en hover.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    title: "Explora por tema",
    totalSuffix: "historias",
    items: [
      { name: "Producto", count: 42, color: "#c2410c" },
      { name: "Diseño", count: 38, color: "#a16207" },
      { name: "Ingeniería", count: 64, color: "#365314" },
      { name: "Negocio", count: 27, color: "#7c2d12" },
      { name: "Cultura", count: 19, color: "#3f3f46" },
      { name: "Entrevistas", count: 12, color: "#831843" },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "totalSuffix", label: "Sufijo conteo (historias)", kind: "text", group: "Contenido" },
    {
      key: "items",
      label: "Categorías",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "name", label: "Nombre", kind: "text" },
        { key: "count", label: "Conteo", kind: "number" },
        { key: "color", label: "Color (hex)", kind: "color" },
      ],
      itemDefault: { name: "Categoría", count: 0, color: "#7c2d12" },
    },
  ],
  propsSchema: z
    .object({
      title: z.string().max(160).default(""),
      totalLabel: z.string().max(80).default(""),
      totalSuffix: z.string().max(40).default("historias"),
      items: z
        .array(
          z.object({
            name: z.string().max(80).default(""),
            count: z.coerce.number().int().min(0).max(99999).default(0),
            color: z.string().max(60).default("#7c2d12"),
          }),
        )
        .default([]),
    })
    .partial(),
};

const MAGAZINE_STORIES: BlockSpec = {
  kind: "tpl-magazine-stories",
  label: "Magazine · Stories 3-col",
  icon: "BookText",
  group: "Plantillas",
  description: "Grid 3-col de stories con cover 3:4 + categoría + título serif + excerpt.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    title: "Más esta semana",
    ctaText: "Ver archivo completo →",
    ctaHref: "#archivo",
    items: [
      {
        cat: "Entrevista",
        title: "Marcos Pérez · 12 años en YCombinator",
        excerpt: "Sobre por qué la mayoría de fundadores resuelven el problema equivocado.",
        cover:
          "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=600&h=800&fit=crop&q=80",
      },
      {
        cat: "Análisis",
        title: "El reverse-takeover de las herramientas internas",
        excerpt: "Tres casos de uso que pasaron de notion-template a empresa de 8 dígitos.",
        cover:
          "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=800&fit=crop&q=80",
      },
      {
        cat: "Opinión",
        title: "El día que dejé de creer en MVPs",
        excerpt: "Y por qué los fundadores deberíamos dejar de usar la palabra ya.",
        cover:
          "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&h=800&fit=crop&q=80",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "ctaText", label: "CTA texto", kind: "text", group: "Contenido" },
    { key: "ctaHref", label: "CTA URL", kind: "url", group: "Contenido" },
    {
      key: "items",
      label: "Stories",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "cat", label: "Categoría", kind: "text" },
        { key: "title", label: "Título", kind: "text" },
        { key: "excerpt", label: "Excerpt", kind: "longtext" },
        { key: "cover", label: "Cover", kind: "url" },
      ],
      itemDefault: { cat: "", title: "", excerpt: "", cover: "" },
    },
  ],
  propsSchema: z
    .object({
      title: z.string().max(160).default(""),
      ctaText: z.string().max(60).default(""),
      ctaHref: safeUrlSchema.default("#"),
      items: z
        .array(
          z.object({
            cat: z.string().max(60).default(""),
            title: z.string().max(200).default(""),
            excerpt: z.string().max(400).default(""),
            cover: httpImgUrl,
          }),
        )
        .default([]),
    })
    .partial(),
};

const MAGAZINE_NEWSLETTER: BlockSpec = {
  kind: "tpl-magazine-newsletter",
  label: "Magazine · Newsletter inline",
  icon: "Mail",
  group: "Plantillas",
  description: "CTA newsletter inline sobre fondo dark con form de suscripción.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    title: "Recibe lo mejor cada lunes.",
    description: "Sin tracking, sin paywalls, sin el típico newsletter spam que nadie pidió.",
    emailPlaceholder: "tu@email.com",
    buttonText: "Suscribir",
    disclaimer: "12.840 lectores · 0% spam · cancelación 1 click",
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "emailPlaceholder", label: "Placeholder email", kind: "text", group: "Contenido" },
    { key: "buttonText", label: "Botón", kind: "text", group: "Contenido" },
    { key: "disclaimer", label: "Disclaimer", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      title: z.string().max(200).default(""),
      description: z.string().max(400).default(""),
      emailPlaceholder: z.string().max(80).default(""),
      buttonText: z.string().max(40).default(""),
      disclaimer: z.string().max(160).default(""),
    })
    .partial(),
};

// ============================================================
// Plantilla 8 — Substack premium (`newsletter-typewriter`)
// ============================================================

const SUBSTACK_HEADER: BlockSpec = {
  kind: "tpl-substack-header",
  label: "Substack · Header",
  icon: "Mail",
  group: "Plantillas",
  description: "Header newsletter con logo circular, título serif, byline, botón suscribirme.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    brand: "El Boletín",
    byline: "por Edgar Vela · cada lunes",
    buttonText: "Suscribirme",
  },
  propsSpec: [
    { key: "brand", label: "Nombre", kind: "text", group: "Contenido" },
    { key: "byline", label: "Byline", kind: "text", group: "Contenido" },
    { key: "buttonText", label: "Botón", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      brand: z.string().max(80).default(""),
      byline: z.string().max(120).default(""),
      buttonText: z.string().max(40).default(""),
    })
    .partial(),
};

const SUBSTACK_HERO: BlockSpec = {
  kind: "tpl-substack-hero",
  label: "Substack · Hero + signup",
  icon: "Sparkles",
  group: "Plantillas",
  description: "Hero serif italic + signup card centered con email input.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    stats: "✦ 12.840 suscriptores · 96% de retención · 4 años",
    titleHtml: "El boletín que tu jefe lee en <em>secreto</em>.",
    description:
      "Análisis sin filtros sobre la industria que nadie más se atreve a publicar. 4 números al mes para premium, 1 al mes gratis.",
    signupEyebrow: "Empieza gratis",
    emailPlaceholder: "tu@email.com",
    signupButtonText: "Suscribirme gratis",
    signupDisclaimer: "· 1 número al mes gratis · cancela cuando quieras · sin spam ·",
  },
  propsSpec: [
    { key: "titleHtml", label: "Título (admite <em>)", kind: "longtext", group: "Contenido" },
    { key: "stats", label: "Stats eyebrow", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    { key: "signupEyebrow", label: "Eyebrow card", kind: "text", group: "Contenido" },
    { key: "emailPlaceholder", label: "Placeholder email", kind: "text", group: "Contenido" },
    { key: "signupButtonText", label: "Botón signup", kind: "text", group: "Contenido" },
    { key: "signupDisclaimer", label: "Disclaimer", kind: "text", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      stats: z.string().max(200).default(""),
      titleHtml: z.string().max(300).default(""),
      description: z.string().max(400).default(""),
      signupEyebrow: z.string().max(80).default(""),
      emailPlaceholder: z.string().max(80).default(""),
      signupButtonText: z.string().max(60).default(""),
      signupDisclaimer: z.string().max(200).default(""),
    })
    .partial(),
};

const SUBSTACK_PREVIEW: BlockSpec = {
  kind: "tpl-substack-preview",
  label: "Substack · Preview paywall",
  icon: "Lock",
  group: "Plantillas",
  description: "Preview de número con fade paywall + card glass con CTA premium.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    eyebrow: "vista previa",
    issueNumber: "número 47",
    title: "Por qué tu CRM no funciona y nadie quiere decírtelo",
    meta: "18 marzo · 14 min lectura · solo premium",
    paragraphs: [
      "Hay tres razones por las que tu equipo de ventas pasa más tiempo introduciendo datos que vendiendo. Y ninguna es la que te dijo el comercial de Salesforce.",
      "La primera empieza en el día uno: nadie pregunta cómo trabaja tu equipo antes de configurar el CRM. Lo configuran como configuran cualquier otro CRM, y luego tu equipo se adapta — o pretende adaptarse, que es la versión que terminas pagando.",
      "La segunda es más sutil. Los KPIs que tu CRM mide son los que su modelo de datos puede medir. No los que tu negocio necesita. Esto explica por qué tu pipeline está siempre lleno y tu cuenta de resultados decepciona...",
    ],
    paywallTitle: "Sigue leyendo — solo premium",
    paywallDescription:
      "Acceso a este número y 200+ del archivo · 8€/mes · cancela cuando quieras.",
    paywallButtonText: "Hacerme premium",
  },
  propsSpec: [
    { key: "title", label: "Título número", kind: "text", group: "Contenido" },
    { key: "eyebrow", label: "Eyebrow", kind: "text", group: "Contenido" },
    { key: "issueNumber", label: "Número", kind: "text", group: "Contenido" },
    { key: "meta", label: "Meta (fecha · minutos)", kind: "text", group: "Contenido" },
    { key: "paywallTitle", label: "Paywall título", kind: "text", group: "Contenido" },
    {
      key: "paywallDescription",
      label: "Paywall descripción",
      kind: "longtext",
      group: "Contenido",
    },
    { key: "paywallButtonText", label: "Paywall botón", kind: "text", group: "Contenido" },
    {
      key: "paragraphs",
      label: "Párrafos preview",
      kind: "items",
      group: "Contenido",
      itemSpec: [{ key: "text", label: "Párrafo", kind: "longtext" }],
      itemDefault: { text: "" },
    },
  ],
  propsSchema: z
    .object({
      eyebrow: z.string().max(40).default(""),
      issueNumber: z.string().max(40).default(""),
      title: z.string().max(200).default(""),
      meta: z.string().max(120).default(""),
      paragraphs: z
        .union([z.array(z.string()), z.array(z.object({ text: z.string() }))])
        .default([]),
      paywallTitle: z.string().max(120).default(""),
      paywallDescription: z.string().max(300).default(""),
      paywallButtonText: z.string().max(40).default(""),
    })
    .partial(),
};

const SUBSTACK_TESTIMONIAL: BlockSpec = {
  kind: "tpl-substack-testimonial",
  label: "Substack · Testimonio gigante",
  icon: "Quote",
  group: "Plantillas",
  description: "Quote icon grande + testimonio italic centrado + author con avatar.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    quote:
      "Es la única newsletter que no archivo. La leo el mismo lunes — y rara vez en la primera lectura, porque las ideas merecen volver.",
    authorName: "M. Sánchez",
    authorRole: "Director de marketing · SaaS B2B",
    authorAvatar:
      "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=80&h=80&fit=crop&q=80",
  },
  propsSpec: [
    { key: "quote", label: "Cita", kind: "longtext", group: "Contenido" },
    { key: "authorName", label: "Nombre", kind: "text", group: "Contenido" },
    { key: "authorRole", label: "Rol", kind: "text", group: "Contenido" },
    { key: "authorAvatar", label: "Avatar URL", kind: "url", group: "Contenido" },
  ],
  propsSchema: z
    .object({
      quote: z.string().max(500).default(""),
      authorName: z.string().max(80).default(""),
      authorRole: z.string().max(120).default(""),
      authorAvatar: httpImgUrl,
    })
    .partial(),
};

const SUBSTACK_PRICING: BlockSpec = {
  kind: "tpl-substack-pricing",
  label: "Substack · Pricing 2-tier",
  icon: "BadgeDollarSign",
  group: "Plantillas",
  description: "Free + Premium recommended con dark card highlighted.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    title: "Una suscripción, todo el archivo.",
    description: "Sin algoritmo. Sin tracking. Sin paywall predador.",
    tiers: [
      {
        label: "Gratis",
        price: "0€",
        period: "para siempre",
        features: ["1 número al mes", "Acceso al último año", "Comunidad pública"],
        buttonText: "Suscribirme gratis",
      },
      {
        label: "Premium",
        price: "8€",
        period: "/ mes",
        subPeriod: "o 80€/año (-17%)",
        features: [
          "4 números al mes",
          "Archivo completo desde 2022",
          "Hilos privados Discord",
          "Q&A trimestral en directo",
          "Cancela en 1 click",
        ],
        buttonText: "Hacerme premium",
        recommended: true,
        recommendedText: "Recomendado",
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "description", label: "Descripción", kind: "longtext", group: "Contenido" },
    {
      key: "tiers",
      label: "Tiers",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Nombre", kind: "text" },
        { key: "price", label: "Precio", kind: "text" },
        { key: "period", label: "Periodo", kind: "text" },
        { key: "subPeriod", label: "Sub-periodo (opt)", kind: "text" },
        { key: "features", label: "Features (1 por línea)", kind: "longtext" },
        { key: "buttonText", label: "Botón", kind: "text" },
        { key: "recommended", label: "Recomendado", kind: "boolean" },
        { key: "recommendedText", label: "Etiqueta recomendado", kind: "text" },
      ],
      itemDefault: {
        label: "Plan",
        price: "0€",
        period: "/mes",
        subPeriod: "",
        features: "feature",
        buttonText: "Elegir",
        recommended: false,
        recommendedText: "",
      },
    },
  ],
  propsSchema: z
    .object({
      title: z.string().max(200).default(""),
      description: z.string().max(400).default(""),
      tiers: z
        .array(
          z.object({
            label: z.string().max(60).default(""),
            price: z.string().max(40).default(""),
            period: z.string().max(60).default(""),
            subPeriod: z.string().max(80).default(""),
            features: z
              .union([z.string(), z.array(z.string())])
              .transform((v) =>
                typeof v === "string"
                  ? v
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : v,
              )
              .default([]),
            buttonText: z.string().max(40).default(""),
            recommended: z.boolean().default(false),
            recommendedText: z.string().max(40).default(""),
          }),
        )
        .default([]),
    })
    .partial(),
};

const SUBSTACK_ARCHIVE: BlockSpec = {
  kind: "tpl-substack-archive",
  label: "Substack · Archive list",
  icon: "Archive",
  group: "Plantillas",
  description: "Lista de archivo con badges Free/Premium.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    title: "Del archivo",
    ctaText: "Ver todos →",
    ctaHref: "#archive",
    freeLabel: "Gratis",
    premiumLabel: "Premium",
    items: [
      {
        n: "#48",
        title: "El sesgo del fundador-narrador",
        excerpt: "Por qué la persona que mejor cuenta tu historia rara vez es quien la vivió.",
        minutes: "12 min",
        date: "1 abr 2026",
        free: false,
      },
      {
        n: "#47",
        title: "Por qué tu CRM no funciona",
        excerpt:
          "Tres razones por las que tu equipo de ventas pasa más tiempo introduciendo datos que vendiendo.",
        minutes: "14 min",
        date: "18 mar 2026",
        free: false,
      },
      {
        n: "#46",
        title: "Cómo distinguir un buen mentor del que solo necesita público",
        excerpt: "Un test de 4 preguntas que aún no he visto fallar.",
        minutes: "9 min",
        date: "11 mar 2026",
        free: true,
      },
      {
        n: "#45",
        title: "El mito del producto que se vende solo",
        excerpt:
          "Ningún producto se vende solo. Y los que lo parecen tienen detrás los mejores comerciales del mundo.",
        minutes: "8 min",
        date: "4 mar 2026",
        free: false,
      },
    ],
  },
  propsSpec: [
    { key: "title", label: "Título", kind: "text", group: "Contenido" },
    { key: "ctaText", label: "CTA texto", kind: "text", group: "Contenido" },
    { key: "ctaHref", label: "CTA URL", kind: "url", group: "Contenido" },
    { key: "freeLabel", label: "Etiqueta Free", kind: "text", group: "Contenido" },
    { key: "premiumLabel", label: "Etiqueta Premium", kind: "text", group: "Contenido" },
    {
      key: "items",
      label: "Archivo",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "n", label: "Número", kind: "text" },
        { key: "title", label: "Título", kind: "text" },
        { key: "excerpt", label: "Excerpt", kind: "longtext" },
        { key: "minutes", label: "Minutos", kind: "text" },
        { key: "date", label: "Fecha", kind: "text" },
        { key: "free", label: "Es gratis", kind: "boolean" },
      ],
      itemDefault: {
        n: "#1",
        title: "",
        excerpt: "",
        minutes: "5 min",
        date: "1 ene 2026",
        free: false,
      },
    },
  ],
  propsSchema: z
    .object({
      title: z.string().max(160).default(""),
      ctaText: z.string().max(60).default(""),
      ctaHref: safeUrlSchema.default("#"),
      freeLabel: z.string().max(40).default(""),
      premiumLabel: z.string().max(40).default(""),
      items: z
        .array(
          z.object({
            n: z.string().max(20).default(""),
            title: z.string().max(200).default(""),
            excerpt: z.string().max(400).default(""),
            minutes: z.string().max(20).default(""),
            date: z.string().max(40).default(""),
            free: z.boolean().default(false),
          }),
        )
        .default([]),
    })
    .partial(),
};

const SUBSTACK_FOOTER: BlockSpec = {
  kind: "tpl-substack-footer",
  label: "Substack · Footer",
  icon: "PanelBottom",
  group: "Plantillas",
  description: "Footer compacto con copyright y links inline.",
  canHaveChildren: false,
  hiddenInPalette: true,
  defaultProps: {
    copyright: "© 2026 El Boletín. Sin algoritmo. Sin tracking.",
    links: [
      { label: "Sobre", href: "#sobre" },
      { label: "Privacidad", href: "#privacidad" },
      { label: "Darse de baja", href: "#baja" },
    ],
  },
  propsSpec: [
    { key: "copyright", label: "Copyright", kind: "text", group: "Contenido" },
    {
      key: "links",
      label: "Links",
      kind: "items",
      group: "Contenido",
      itemSpec: [
        { key: "label", label: "Texto", kind: "text" },
        { key: "href", label: "URL", kind: "url" },
      ],
      itemDefault: { label: "Link", href: "#" },
    },
  ],
  propsSchema: z
    .object({
      copyright: z.string().max(200).default(""),
      links: z.array(linkItemZ).default([]),
    })
    .partial(),
};

// ============================================================
// Export combinado — se concatena al BLOCK_SPECS principal en registry.ts
// ============================================================
export const SPECTACULAR_SPECS: BlockSpec[] = [
  // Asme (saas-magnetic)
  ASME_HERO,
  ASME_ABOUT,
  ASME_FEATURED_VIDEO,
  ASME_SPLIT_VISION,
  ASME_SERVICE_CARDS,
  ASME_CTA,
  // Jack (portfolio-spotlight)
  JACK_HERO,
  JACK_MARQUEE,
  JACK_ABOUT,
  JACK_SERVICES,
  JACK_PROJECTS_SPEC,
  JACK_CTA,
  // Michael (agency-spotlight)
  MICHAEL_HERO,
  MICHAEL_BENTO,
  MICHAEL_JOURNAL,
  MICHAEL_EXPLORATIONS,
  MICHAEL_STATS,
  MICHAEL_CONTACT_FOOTER,
  // Mint (coming-soon-typewriter)
  MINT_HERO,
  MINT_PERKS,
  MINT_ROADMAP,
  // Nimbus (docs-aurora)
  NIMBUS_HERO,
  NIMBUS_DOCS_GRID,
  NIMBUS_QUICK_START,
  NIMBUS_COMMUNITY,
  // Securify (launch-marquee)
  SECURIFY_HERO,
  SECURITY_SECTORS,
  SECURITY_PILLARS,
  SECURITY_PRICING,
  SECURITY_CTA,
  // Magazine (blog-particles)
  MAGAZINE_MASTHEAD,
  MAGAZINE_FEATURED,
  MAGAZINE_CATEGORIES,
  MAGAZINE_STORIES,
  MAGAZINE_NEWSLETTER,
  // Substack (newsletter-typewriter)
  SUBSTACK_HEADER,
  SUBSTACK_HERO,
  SUBSTACK_PREVIEW,
  SUBSTACK_TESTIMONIAL,
  SUBSTACK_PRICING,
  SUBSTACK_ARCHIVE,
  SUBSTACK_FOOTER,
];
