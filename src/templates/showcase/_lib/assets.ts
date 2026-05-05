/**
 * Catálogo de assets curados para las plantillas showcase.
 *
 * Todos los assets son CDN públicos pre-aprobados (motionsites.ai, cloudfront,
 * unsplash, figma.site). NUNCA mezclar con assets user-generated del workspace.
 *
 * Patrón: cada plantilla importa su set; cambiar URL en un sitio repercute en
 * todos los usos. Si una URL muere, se actualiza aquí.
 */

const CF = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P";
const FIGMA = "https://shrug-person-78902957.figma.site/_components/v2";
const MS = "https://motionsites.ai/assets";

// ============================================================
// Vídeos (.mp4) — todos para autoplay loop muted
// ============================================================
export const VIDEOS = {
  // Editorial dark / Creative portrait
  editorialPortrait: `${CF}/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4`,
  // Asme / liquid glass hero ambient
  asmeHero: `${CF}/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4`,
  asmeFeatured: `${CF}/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4`,
  asmePhilosophy: `${CF}/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4`,
  asmeService1: `${CF}/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4`,
  asmeService2: `${CF}/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4`,
  // Securify / data security
  securifyHero: `${CF}/hf_20260418_063509_7d167302-4fd4-480b-8260-18ab572333d4.mp4`,
  // Targo / logistics
  targoHero: `${CF}/hf_20260227_042027_c4b2f2ea-1c7c-4d6e-9e3d-81a78063703f.mp4`,
  // Power AI / Nimbus
  nimbusHero: `${CF}/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4`,
} as const;

// ============================================================
// Imágenes — Jack portfolio
// ============================================================
export const JACK_IMG = {
  portrait: `${FIGMA}/d24c01ad3a56fc65e942a1f501eb73db42d7cf9a/Rectangle_40443.81459862.png`,
  moon: `${FIGMA}/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/moon_icon.11395d36.png`,
  threeDLeft: `${FIGMA}/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/p59_1.4659672e.png`,
  lego: `${FIGMA}/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/lego_icon-1.703bb594.png`,
  threeDRight: `${FIGMA}/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/Group_134-1.2e04f3ce.png`,
};

// ============================================================
// Marquee GIFs (motionsites previews)
// ============================================================
export const MARQUEE_GIFS = [
  `${MS}/hero-space-voyage-preview-eECLH3Yc.gif`,
  `${MS}/hero-codenest-preview-Cgppc2qV.gif`,
  `${MS}/hero-vex-ventures-preview-BczMFIiw.gif`,
  `${MS}/hero-stellar-ai-v2-preview-DjvxjG3C.gif`,
  `${MS}/hero-asme-preview-B_nGDnTP.gif`,
  `${MS}/hero-transform-data-preview-Cx5OU29N.gif`,
  `${MS}/hero-vitara-preview-Cjz2QYyU.gif`,
  `${MS}/hero-terra-preview-BFjrCr7T.gif`,
  `${MS}/hero-skyelite-preview-DHaZIgUv.gif`,
  `${MS}/hero-aethera-preview-DknSlcTa.gif`,
  `${MS}/hero-designpro-preview-D8c5_een.gif`,
  `${MS}/hero-stellar-ai-preview-D3HL6bw1.gif`,
  `${MS}/hero-xportfolio-preview-D4A8maiC.gif`,
  `${MS}/hero-orbit-web3-preview-BXt4OttD.gif`,
  `${MS}/hero-nexora-preview-cx5HmUgo.gif`,
  `${MS}/hero-evr-ventures-preview-DZxeVFEX.gif`,
  `${MS}/hero-planet-orbit-preview-DWAP8Z1P.gif`,
  `${MS}/hero-new-era-preview-CocuDUm9.gif`,
  `${MS}/hero-wealth-preview-B70idl_u.gif`,
  `${MS}/hero-luminex-preview-CxOP7ce6.gif`,
  `${MS}/hero-celestia-preview-0yO3jXO8.gif`,
];

// ============================================================
// Project images — Jack sticky stacking cards
// ============================================================
const HIGGS = (path: string) =>
  `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/${path}`)}&w=1280&q=85`;

export const JACK_PROJECTS = [
  {
    number: "01",
    name: "Nextlevel Studio",
    category: "Cliente",
    img1: HIGGS("hf_20260412_055344_5eff02e0-87a5-41ce-b64f-eb08da8f33db.png"),
    img2: HIGGS("hf_20260412_055431_11d841fd-8b41-46a5-82e4-b04f2407a7d8.png"),
    img3: HIGGS("hf_20260412_055451_e317bf2d-28d4-48cc-86b0-6f72f25b6327.png"),
  },
  {
    number: "02",
    name: "Aura Brand Identity",
    category: "Personal",
    img1: HIGGS("hf_20260412_055654_911201c5-36d9-4bc6-bac7-331adfce159f.png"),
    img2: HIGGS("hf_20260412_055723_5ceda0b8-d9c2-4665-b2e3-83ba19ba76d1.png"),
    img3: HIGGS("hf_20260412_055753_adc5dcbd-a8e6-49c0-b43a-9b030d835cea.png"),
  },
  {
    number: "03",
    name: "Solaris Digital",
    category: "Cliente",
    img1: HIGGS("hf_20260412_055759_963cfb0b-4bd1-4b0f-9d0a-09bd6cf95b2f.png"),
    img2: HIGGS("hf_20260412_060108_438f781a-9846-4dcc-89ab-c4e6cb830f5b.png"),
    img3: HIGGS("hf_20260412_055818_9d062121-ad7e-46b9-999a-1a6a692ef1ee.png"),
  },
];

// ============================================================
// Unsplash helpers — para plantillas que usan stock fotos
// ============================================================
export const unsplash = (id: string, w = 1200, h = 800) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

// Pack curado para Bento Grid editorial
export const EDITORIAL_GRID = {
  automotive: unsplash("1494976388531-d1058494cdd8", 1200, 900),
  architecture: unsplash("1486325212027-8081e485255e", 1200, 900),
  human: unsplash("1531123897727-8f129e1688ce", 1200, 900),
  brand: unsplash("1561070791-2526d30994b8", 1200, 900),
};

export const EXPLORATIONS = [
  unsplash("1517694712202-14dd9538aa97", 800, 800),
  unsplash("1493723843671-1d655e66ac1c", 800, 800),
  unsplash("1517180102446-f3ece451e9d8", 800, 800),
  unsplash("1551434678-e076c223a692", 800, 800),
  unsplash("1486312338219-ce68d2c6f44d", 800, 800),
  unsplash("1558655146-9f40138edfeb", 800, 800),
];

export const JOURNAL_THUMBS = [
  unsplash("1542435503-956c469947f6", 240, 240),
  unsplash("1520975916090-3105956dac38", 240, 240),
  unsplash("1487058792275-0ad4aaf24ca7", 240, 240),
  unsplash("1531297484001-80022131f5a1", 240, 240),
];
