# Plantillas Showcase — Prompts canónicos

Estos son los prompts originales que generaron el nivel de diseño objetivo (motionsites.ai-tier). Sirven como **norte visual canónico** de cada plantilla cuando se reescriben los `buildLayout()` con bloques editables.

Cada prompt incluye: paleta exacta, fuentes Google, URLs de assets (vídeos cloudfront, imágenes higgs, gifs motionsites), copy original, breakpoints fluid (clamp), efectos (HLS, glassmorphism, parallax, magnetic, char-reveal).

Mantener estos prompts como fuente de verdad: si algún bloque del page builder se desvía visualmente, el prompt manda.

---

## 1. Jack — 3D Creator (`portfolio-spotlight`)

> **Stack**: React + TS + Tailwind + Framer Motion + Lucide. Dark `#0C0C0C`. Font Kanit (300-900).
> **Hero gradient**: `linear-gradient(180deg, #646973 0%, #BBCCD7 100%)` (clase `.hero-heading`).

### Secciones
1. **Hero**: navbar 4 links uppercase tracking-wider · h1 "Hi, i'm jack" font-black tamaño `clamp(4rem, 16vw, 17.5vw)` con gradiente · portrait magnético abs. centrado (URL figma.site Rectangle_40443) padding 150 strength 3 · bottom bar con copy `clamp(0.75rem,1.4vw,1.5rem)` + ContactButton.
2. **Marquee 2 filas**: 21 GIFs motionsites.ai (lista exacta abajo), tile 420×270 rounded-2xl, fila 1 derecha+11gifs, fila 2 izquierda+10gifs, scroll-driven `(scrollY-sectionTop+vh)*0.3`.
3. **About**: `min-h-screen` fondo `#0C0C0C` · 4 corners decorativos figma.site (moon, p59_1, lego, Group_134) abs. en esquinas · h2 "About me" mismo gradient/font-black `clamp(3rem,12vw,160px)` · paragraph char-reveal scroll-driven (opacity 0.2→1 por char) · ContactButton.
4. **Services white**: bg `#FFFFFF` rounded-t-[60px] · h2 "Services" en `#0C0C0C` mismo tamaño · 5 items vertical (01–05) número gigante left, name uppercase + desc font-light right, separadores 1px `rgba(12,12,12,0.15)`, FadeIn stagger `i*0.1`. Items: 3D Modeling, Rendering, Motion Design, Branding, Web Design (copy ES).
5. **Projects sticky stack**: bg dark rounded-t-[60px] -mt-10 z-10 · h2 "Project" gradient · 3 cards sticky-top-24 dentro h-[85vh] cada una · scale `1-(total-1-i)*0.03` + offset top `i*28px` · cada card border-2 `#D7E2EA` rounded-[60px] padding p-8 · header: número gigante + categoría + nombre + LiveProjectButton ghost · grid 2/3+5/2: col1 (40%) 2 imgs apiladas, col2 (60%) 1 img tall · 3 proyectos: Nextlevel Studio (Cliente), Aura Brand Identity (Personal), Solaris Digital (Cliente) — URLs higgs/cloudfront.
6. **CTA**: bg dark · h2 "Let's build something" gradient · subtext font-light max-w-md · ContactButton · copyright "© 2026 Jack — 3D Creator. Hecho con cariño en Barcelona."

### Componentes reusables
- **ContactButton**: rounded-full · gradient `linear-gradient(123deg, #18011F 7%, #B600A8 37%, #7621B0 72%, #BE4C00 100%)` · inner box-shadow `0px 4px 4px rgba(181,1,167,0.25), 4px 4px 12px #7721B1 inset` · outline white 2px offset -3px · texto white uppercase tracking-widest · "Contact Me".
- **LiveProjectButton**: ghost rounded-full border-2 `#D7E2EA` · "Live Project".
- **FadeIn**: framer whileInView, viewport `{once:true,margin:"50px",amount:0}`, easing `[0.25,0.1,0.25,1]`.
- **Magnet**: padding 150 · strength 3 · in `transform 0.3s ease-out` · out `transform 0.6s ease-in-out`.
- **AnimatedText**: char-by-char useScroll offset `["start 0.8","end 0.2"]`.

### Assets (URLs exactas)
- Portrait: `https://shrug-person-78902957.figma.site/_components/v2/d24c01ad3a56fc65e942a1f501eb73db42d7cf9a/Rectangle_40443.81459862.png`
- Moon: `.../moon_icon.11395d36.png`
- p59_1: `.../p59_1.4659672e.png`
- Lego: `.../lego_icon-1.703bb594.png`
- Group_134: `.../Group_134-1.2e04f3ce.png`
- 21 GIFs marquee: `https://motionsites.ai/assets/hero-{space-voyage|codenest|vex-ventures|stellar-ai-v2|asme|transform-data|vitara|terra|skyelite|aethera|designpro|stellar-ai|xportfolio|orbit-web3|nexora|evr-ventures|planet-orbit|new-era|wealth|luminex|celestia}-preview-*.gif`
- Project imgs: `https://images.higgs.ai/?default=1&output=webp&url=...cloudfront.../user_38xzZboKViGWJOttwIXH07lWA1P/hf_2026041*.png&w=1280&q=85` (9 imágenes, ver código original).

---

## 2. Michael Smith — Editorial Dark (`agency-spotlight`)

> **Stack**: React + Vite + TS + Tailwind + GSAP + Framer Motion + hls.js. Theme dark forzado.
> **HSL vars** (sin `hsl()` wrapper, Tailwind lo añade):
> ```
> --bg: 0 0% 4%; --surface: 0 0% 8%; --text: 0 0% 96%; --muted: 0 0% 53%; --stroke: 0 0% 12%; --accent: 0 0% 96%;
> ```
> **Fuentes**: Inter (300-700) body · Instrument Serif italic 400 display.
> **Accent gradient**: `linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)` clase `.accent-gradient`.

### Secciones
1. **Loading screen** full overlay `fixed inset-0 z-[9999]` · counter rAF 000→100 sobre 2700ms · top-left "Portfolio" text-xs muted `tracking-[0.3em]` · centro rotating words ["Design","Create","Inspire"] cada 900ms con AnimatePresence y/-y · bottom-right counter `text-9xl font-display tabular-nums` · progress bar h-3 con `.accent-gradient` `scaleX(count/100)` + `box-shadow:0 0 8px rgba(137,170,204,0.35)`. onComplete: 400ms delay → callback.
2. **Hero**: video HLS bg `https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8` autoPlay muted loop · navbar fixed top centrado pill `liquid-glass` (logo "JA" 9×9 con accent-gradient ring + 3 nav + Say hi gradient) · eyebrow "COLLECTION '26" tracking-`[0.3em]` · h1 "Michael Smith" `text-9xl font-display italic` `leading-[0.9]` · línea con role cycling `["Creative","Fullstack","Founder","Scholar"]` cada 2s key=roleIndex · descripción `text-muted max-w-md` · CTAs: "See Works" solid (bg-text-primary text-bg, hover invierte con accent ring) + "Reach out..." outlined border-2-stroke. GSAP timeline ease `power3.out`.
3. **Selected Works** (Bento): max-w-1200 · header eyebrow + h2 "Featured *projects*" italic + subtext + "View all work" hidden md · grid `md:grid-cols-12 gap-6` spans alternados 7/5/5/7 · 4 cards Automotive Motion / Urban Architecture / Human Perspective / Brand Identity · cada card `bg-surface border-stroke rounded-3xl` con halftone overlay `radial-gradient(circle, #000 1px, transparent 1px) 4×4 opacity-20 mix-blend-multiply` · hover bg-bg/70 + backdrop-blur-lg + label pill con animated gradient border "View — *Title*".
4. **Journal**: same eyebrow pattern · h2 "Recent *thoughts*" · 4 entries pills `rounded-full p-4 bg-surface/30` con título + img + minutes + fecha.
5. **Explorations parallax**: `min-h-[300vh]` · layer1 pinned center con eyebrow "Explorations" + h2 "Visual *playground*" + Dribbble CTA · layer2 absolute grid-cols-2 con 6 items split, parallax GSAP, aspect-square max-w-[320px], rotación + lightbox.
6. **Stats**: 3-col `20+ Years Experience / 95+ Projects Done / 200% Satisfied Clients`.
7. **Contact / Footer**: bg-bg pt-20 · video HLS bg flipped `scale-y-[-1]` overlay `bg-black/60` · GSAP marquee "BUILDING THE FUTURE • " ×10, `xPercent:-50, duration:40, ease:"none", repeat:-1` · email button con gradient hover ring · footer bar [Twitter, LinkedIn, Dribbble, GitHub] + Green pulsing dot + "Available for projects".

---

## 3. Asme — Liquid Glass (`saas-magnetic`)

> **Stack**: React + TS + Vite + Tailwind + framer-motion + lucide-react.
> **Bg**: `bg-black`. **Font**: Instrument Serif (italic + regular) via `@import` Google Fonts.

### .liquid-glass (CSS exacto, en `@layer components`)
```css
.liquid-glass {
  background: rgba(255,255,255,0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  position: relative; overflow: hidden;
}
.liquid-glass::before {
  content:''; position:absolute; inset:0; border-radius:inherit; padding:1.4px;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%,
    rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

### Secciones
1. **Hero fullscreen video crossfade** (no CSS transitions, vanilla rAF):
   - Video `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4` cover object-bottom muted autoPlay playsInline preload="auto", `opacity:0`.
   - Fade logic: canplay → fade 0→1 over 500ms; timeupdate remaining<=0.55s → fade →0 over 500ms; ended → opacity 0, 100ms wait, currentTime=0, replay, fade →1.
   - Navbar: `liquid-glass rounded-full pill max-w-5xl px-6 py-3 flex between` · left Globe + "Asme" + nav `Features/Pricing/About` (text-white/80) · right Sign Up + Login pill.
   - h1 `text-9xl tracking-tight whitespace-nowrap font-family Instrument Serif`: `Know it then <em italic>all</em>`.
   - Email pill: `liquid-glass rounded-full pl-6 pr-2 py-2` · input transparente placeholder "Enter your email" · botón circular white `p-3` con ArrowRight 20px.
   - Subtitle: "Stay updated with the latest news and insights..."
   - Manifesto button glass.
   - Social icons footer: Instagram, Twitter, Globe en pills glass.
2. **About**: `pt-44 pb-14 px-6` · radial gradient overlay `radial-gradient(ellipse_at_top,rgba(255,255,255,0.03)_0%,transparent_70%)` · "About Us" tracking-widest uppercase white/40 · h2 `text-7xl leading-[1.1]` con italic spans white/60: "Pioneering *ideas* for / minds that *create, build, and inspire*."
3. **Featured Video full-bleed**: max-w-6xl · `rounded-3xl overflow-hidden aspect-video` · video `hf_20260402_054547_*.mp4` · gradient `bg-gradient-to-t from-black/60 via-transparent to-transparent` · bottom overlay flex row con liquid-glass card "Our Approach / We believe in the power of curiosity-driven exploration..." + "Explore more" button glass con whileHover scale-1.05.
4. **Innovation × Vision split**: `py-40 px-6` max-w-6xl · h2 `text-7xl tracking-tight mb-24`: `Innovation *×* Vision` (× italic white/40) · grid-cols-2 gap-12 · izquierda video aspect-[4/3] `hf_20260307_083826_*.mp4` x:-40 · derecha 2 bloques separados por `h-px bg-white/10`: "Choose your space" + "Shape the future" copy completo.
5. **Services 2-card**: `py-40 px-6` max-w-6xl · radial overlay center `rgba(255,255,255,0.02)` · header flex between "What we do" + "Our services" hidden md · grid-cols-2 gap-8 · 2 cards `liquid-glass rounded-3xl group` · video aspect-video object-cover transition group-hover:scale-105 · gradient `from-black/40 to-transparent` · body p-8 con tag uppercase tracking-widest white/40 + ArrowUpRight en pill glass + título text-2xl tracking-tight + desc white/50.
   - Card1: `hf_20260314_131748_*.mp4` · "Strategy" · "Research & Insight" · "We dig deep into data, culture, and human behavior..."
   - Card2: `hf_20260324_151826_*.mp4` · "Craft" · "Design & Execution" · "From concept to launch, we obsess over every detail..."

---

## 4. Securify + Targo — B2B Dark (`launch-marquee`)

### Securify hero (data-security SaaS)
> **Font**: Readex Pro (300,400,500,600,700). Body `bg-#000 color-#fff antialiased`. `.hero-title { letter-spacing: -0.04em; line-height: 0.95; }`. **Sin morado/indigo** — solo black/white/neutral-900 + white opacity variants.

- Section `relative h-screen overflow-hidden bg-black`.
- Video: `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_063509_7d167302-4fd4-480b-8260-18ab572333d4.mp4` absolute inset-0 object-cover autoPlay loop muted playsInline.
- Navbar absolute z-20 px-10 pt-6 flex between:
  - **Left pill** `bg-neutral-900/90 backdrop-blur rounded-full pl-4 pr-6 py-3`: SVG logo 256×256 (4 chevrons fill #fff) `h-5 w-5` + "securify" text-white text-sm tracking-tight.
  - **Center pill** hidden md `bg-neutral-900/90 backdrop-blur rounded-full px-3 py-2`: 4 anchors `platform / solutions / company / support` text-neutral-300 hover-white text-sm px-5 py-2 rounded-full.
  - **Right**: "get started" `bg-white text-black rounded-full px-6 py-3 hover:bg-neutral-200`.
- Foreground `relative h-full w-full`:
  - 3 staggered headlines, cada uno `<h1 class="hero-title absolute text-white font-medium text-[14vw] md:text-[13vw]">`: "protect" left-10 top-[18%] · "your" right-10 top-[38%] · "data" left-[28%] top-[58%]. Todo lowercase.
  - Description abs `left-10 top-[46%] max-w-[240px] text-[15px] leading-snug text-white/90`: "we can guarding your data with utmost care, empowering you with privacy everywhere".
  - Stat top-right `right-24 top-[14%]`: row gap-3 con divider `h-px w-24 bg-white/40 rotate-[20deg]` (hidden md) + "+65k" `text-5xl font-medium tracking-tight`. Sublabel "startups use" text-white/70.
  - Stat bottom-left `left-20 bottom-24`: "+1.5b" + divider rotate-[-20deg]. Sublabel "gb data was protected".
  - Stat bottom-right `right-20 bottom-20`: divider rotate-[-20deg] + "+300k". Sublabel "downloads" right-aligned.
- Bottom gradient: `pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-black`.

### Targo hero (logística)
> **Brand**: black `#000000` · red `#EE3F2C` · white. **Font**: Rubik (uppercase headlines tight `-0.04em`).

- Header clean top: SVG logo abstract + "targo" wordmark white left · nav "Home / About / Contact Us" + small red "Contact Us" button con corners clipped.
- Main hero: headline "Swift and Simple Transport" + "Get Started" left-aligned upper-third (no centrado).
- Bottom widget: "Book a Free Consultation" card bottom-left.
- **Video bg**: `hf_20260227_042027_c4b2f2ea-1c7c-4d6e-9e3d-81a78063703f.mp4` 100% opacity, sin overlay.
- **Clipped corners** todos los buttons: CSS `clip-path` con 10-12px diagonal cut top-right + bottom-left. Red para "Get Started", solid white para "Book a Call".
- **Liquid Glass** consultation card: `backdrop-filter:blur(40px) saturate(180%)` + 1px white border 12% opacity + diagonal white-to-transparent shine + inner box-shadow.
- Headline ~64px desktop, 42px mobile. Padding 64px desktop / 32px mobile.
- Phone icon de lucide-react dentro del consultation button.

---

## 5. Power AI / Nimbus — Aurora Gradient (`docs-aurora`)

> **Theme**: bg `260 87% 3%` (deep dark blue-purple) · fg `40 6% 95%` · sub `40 6% 82%`. **Fonts**: Geist Sans body via `@fontsource/geist-sans` · General Sans display vía Fontshare `https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap`.

### Secciones
1. **Hero gradient + video bg + logo marquee**:
   - Background video Index wrapper: `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4` `absolute inset-0 w-full h-full object-cover` opacity 0 fade-in 500ms / fade-out 500ms / replay con rAF. **Sin overlays**.
   - Wrapper `overflow-hidden`, contenido `relative z-10`.
   - **Blurred shape** detrás del contenido: `w-[984px] h-[527px] opacity-90 bg-gray-950 blur-[82px]` abs centrado, pointer-events-none. Hero section `overflow-visible`.
   - **Navbar**: full width py-5 px-8 flex between · left logo image (`src/assets/logo.png` h-32px) · center "Features (ChevronDown) / Solutions / Plans / Learning (ChevronDown)" botones text-foreground/90 · right "Sign Up" heroSecondary rounded-full px-4 py-2.
   - Below navbar: 1px gradient divider `from-transparent via-foreground/20 to-transparent` `mt-[3px]`.
   - **Hero content** flex-1 centered:
     - h1 "Power AI" `text-[220px] font-normal leading-[1.02] tracking-[-0.024em] font-family General Sans`. "Power " plain text-foreground · "AI" `bg-clip-text text-transparent` con `linear-gradient(to left, #6366f1, #a855f7, #fcd34d)` (indigo→purple→amber).
     - Subtitle: `text-hero-sub text-lg leading-8 max-w-md mt-[9px] opacity-80`: "The most powerful AI ever deployed / in talent acquisition".
     - CTA: "Schedule a Consult" heroSecondary `px-[29px] py-[24px] mt-[25px]`.
   - **Logo marquee** pinned bottom pb-10:
     - max-w-5xl mx-auto.
     - Left: static "Relied on by brands / across the globe" text-foreground/50 text-sm.
     - Right: infinite scrolling logos: Vortex, Nimbus, Prysma, Cirrus, Kynder, Halcyn (duplicados para loop). Cada logo: liquid-glass 24×24 rounded-lg con primera letra + name text-base font-semibold. Animación `translateX(0%) → translateX(-50%)` 20s linear infinite. gap-16 entre logos, gap-12 entre texto y marquee.

### `.liquid-glass` (idéntica a Asme — copiar literal, ver sección 3)

### Secciones (2-4): docs-grid 6col, quick-start split-code, community-cta
> Copy ES, copia íntegra del showcase actual `docs-aurora.tsx`.

---

## 6. Mint Pre-Launch — Coming Soon (`coming-soon-typewriter`)

### Secciones (del showcase actual + spec del audit)
1. **Hero countdown email**: VideoLoop `VIDEOS.asmePhilosophy` + LiquidGlass · logo + topRightButton · badge italic gradient · heroBrand + heroTitle italic `gradient` · description · countdown live (días/h/min/seg) `target ISO` · email pill placeholder + ArrowRight submit · disclaimer.
2. **Perks 3-col**: sectionLabel + sectionTitle + 3 perks `{icon, title, desc}`.
3. **Roadmap timeline**: sectionLabel + sectionTitle + items `[{date, label, done}]`.

---

## 7. Magazine Paper — Blog (`blog-particles`)

### Secciones
1. **Masthead serif**: issueNumber + publicationName + nav links + subscribe button + nav serial.
2. **Featured 8/4 + sidebar**: featured `{category, title, hook, author, minutes, date, cover}` + sidebar items `{cat, title, author, minutes, cover}`.
3. **Categories grid 2×3**: sectionLabel + sectionTitle + totalStoriesCount + categories `{name, count, color}`.
4. **Stories grid 3-col**: sectionTitle + sectionCTA + stories `{cat, title, excerpt, cover}`.
5. **Newsletter inline**: sectionTitle + description + emailPlaceholder + buttonText + disclaimer + subscriberCount.

---

## 8. Substack Premium — Newsletter (`newsletter-typewriter`)

### Secciones
1. **Masthead serif**: logo `{icon, label, byline}` + subscribeButton.
2. **Hero signup card**: stats + heroBrand + heroTitle italic + description + signup form + disclaimer.
3. **Preview issue paywall**: previewLabel + issueNumber + previewTitle/date/excerpt + paywall `{icon, label, description, buttonText}`.
4. **Testimonial gigante**: quoteText + authorName/role/image + Quote icon.
5. **Pricing 2-tier serif**: tiers `{label, price, period, features[], buttonText, recommended?, featured?}`.
6. **Archive list tiered**: items `{n, title, excerpt, minutes, date, free}` con badges Free/Premium.

---

## Block kinds nuevos (~14 propuestos)

Cada block kind se nombra con prefijo `tpl-` para que en el palette del page builder estén agrupados. Algunos tienen variantes (`variant` prop) cuando comparten primitives entre showcases.

| Kind | Variantes | Showcases que lo usan |
|---|---|---|
| `tpl-hero-magnetic-portrait` | — | jack |
| `tpl-hero-loading-cycle` | — | michael |
| `tpl-hero-glass-video` | — | asme |
| `tpl-hero-staggered-stats` | securify, targo | securify+targo |
| `tpl-hero-aurora-gradient` | — | nimbus |
| `tpl-hero-countdown-email` | — | mint |
| `tpl-hero-magazine-masthead` | — | magazine |
| `tpl-hero-newsletter-signup` | — | substack |
| `tpl-marquee-row` | gifs, text, logos | jack, michael, securify, nimbus |
| `tpl-sticky-stack-projects` | — | jack |
| `tpl-bento-grid` | 4-asym, 6-equal | michael |
| `tpl-parallax-explorations` | — | michael |
| `tpl-glass-feature-video` | full-bleed, split-2col, service-cards | asme |
| `tpl-editorial-headline` | huge-italic, char-reveal, numbered-services | varios |
| `tpl-pricing-spectacular` | clipped-corners, elegant-2tier | securify, substack |
| `tpl-magazine-section` | featured-8-4, categories-colored, stories-3col, newsletter-inline | magazine |
| `tpl-newsletter-archive` | paywall-fade, archive-tiered, testimonial-giant | substack |
| `tpl-docs-grid` | logo-marquee, docs-cards, code-sample, community-cta | nimbus |
| `tpl-roadmap-timeline` | — | mint |
| `tpl-perks-row` | — | mint |
| `tpl-stat-blocks` | inline-3, positioned-abs | michael, securify |
| `tpl-corner-decorations` | — | jack (helper section) |

Total: ~21 block kinds nuevos.

## Decisiones arquitectónicas

1. **Render**: cada bloque tiene una variante client component que se monta cuando aparece en una página (igual que `motion-hero` ya hace). Las animaciones (framer-motion, useScroll, etc) viven en el client component.
2. **Schema**: `propsSchema` Zod estricto con defaults sólidos del prompt. Validación server-side antes de persistir.
3. **Inspector**: `propsSpec` permite editar todos los textos/URLs/items desde el page builder. Para variantes específicas (countdown target, marquee items, etc) se exponen como campos.
4. **Defaults**: cada bloque al insertarse usa los textos exactos del prompt original (copy ES cuando aplique).
5. **buildLayout()** de cada plantilla devuelve un array de bloques `tpl-*` con sus defaults. **El preview ahora usa `RenderLayout(buildLayout())`** — preview = inserted page, paridad por construcción. Se elimina la rama `getShowcase(id)` del route `/template-preview/[id]`.
6. **Assets**: las URLs hardcodeadas en `_lib/assets.ts` se mantienen como **defaults** de los bloques. El usuario puede sobrescribir con su propio media del DAM.
