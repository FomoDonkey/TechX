"use client";

/**
 * Showcase: Portfolio 3D Creator (Jack-style).
 * Hero magnético + portrait + marquee scroll-driven 21 GIFs en 2 filas opuestas
 * + about con char-reveal + 3D corner objects + services lista numerada
 * + 3 sticky stacking project cards.
 */

import { JACK_IMG, JACK_PROJECTS, MARQUEE_GIFS } from "@/templates/showcase/_lib/assets";
import {
  AnimatedTextReveal,
  FadeIn,
  Magnet,
  MarqueeRow,
  StickyStackCard,
} from "@/templates/showcase/_lib/primitives";

const SERVICES = [
  {
    n: "01",
    name: "3D Modeling",
    desc: "Creación de objetos, personajes y entornos detallados según las necesidades de cada cliente — perfecto para juegos, productos y visualizaciones.",
  },
  {
    n: "02",
    name: "Rendering",
    desc: "Renders fotorrealistas con luz, texturas y materiales custom para que el diseño cobre vida con calidad de cinematógrafo.",
  },
  {
    n: "03",
    name: "Motion Design",
    desc: "Animaciones y motion graphics que aportan energía y narrativa a marcas, productos y experiencias digitales.",
  },
  {
    n: "04",
    name: "Branding",
    desc: "Identidades visuales coherentes — del logo al sistema de marca completo — que comunican una presencia memorable.",
  },
  {
    n: "05",
    name: "Web Design",
    desc: "Webs limpias, modernas y orientadas a conversión, con atención al layout, la tipografía y la experiencia.",
  },
];

export function PortfolioSpotlightShowcase() {
  return (
    <div className="csm-show-jack csm-showcase">
      <main style={{ overflowX: "clip" }}>
        {/* ================== 1. HERO ================== */}
        <section className="relative flex h-screen w-full flex-col">
          {/* Navbar */}
          <FadeIn
            as="header"
            y={-20}
            duration={0.6}
            className="relative z-20 flex w-full items-center justify-between px-6 pt-6 md:px-10 md:pt-8"
          >
            <a
              href="#about"
              className="text-sm font-medium uppercase tracking-wider text-[#d7e2ea] transition-opacity hover:opacity-70 md:text-lg"
            >
              About
            </a>
            <a
              href="#price"
              className="text-sm font-medium uppercase tracking-wider text-[#d7e2ea] transition-opacity hover:opacity-70 md:text-lg"
            >
              Price
            </a>
            <a
              href="#projects"
              className="text-sm font-medium uppercase tracking-wider text-[#d7e2ea] transition-opacity hover:opacity-70 md:text-lg"
            >
              Projects
            </a>
            <a
              href="#contact"
              className="text-sm font-medium uppercase tracking-wider text-[#d7e2ea] transition-opacity hover:opacity-70 md:text-lg"
            >
              Contact
            </a>
          </FadeIn>

          {/* Big heading */}
          <FadeIn
            y={40}
            delay={0.15}
            duration={0.9}
            className="relative z-10 -mt-2 overflow-hidden md:-mt-4"
          >
            <h1
              className="hero-heading w-full whitespace-nowrap text-center font-black uppercase leading-none tracking-tight"
              style={{
                fontSize: "clamp(4rem, 16vw, 17.5vw)",
              }}
            >
              Hi, i&apos;m jack
            </h1>
          </FadeIn>

          {/* Magnetic portrait */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 sm:top-auto sm:bottom-0 sm:translate-y-0">
            <Magnet padding={150} strength={3}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={JACK_IMG.portrait}
                alt="Jack portrait"
                className="block w-[280px] sm:w-[360px] md:w-[440px] lg:w-[520px]"
              />
            </Magnet>
          </div>

          {/* Bottom bar */}
          <div className="relative z-10 mt-auto flex items-end justify-between px-6 pb-7 md:px-10 md:pb-10">
            <FadeIn
              delay={0.35}
              duration={0.8}
              y={20}
              className="max-w-[160px] sm:max-w-[220px] md:max-w-[260px]"
            >
              <p
                className="font-light uppercase leading-snug tracking-wide text-[#d7e2ea]"
                style={{ fontSize: "clamp(0.75rem, 1.4vw, 1.25rem)" }}
              >
                A 3D creator driven by crafting striking and unforgettable projects
              </p>
            </FadeIn>
            <FadeIn delay={0.5} y={20}>
              <ContactPill />
            </FadeIn>
          </div>
        </section>

        {/* ================== 2. MARQUEE 2 ROWS ================== */}
        <section className="bg-[#0c0c0c] pb-10 pt-24 sm:pt-32 md:pt-40">
          <div className="flex flex-col gap-3">
            <MarqueeRow direction="right" speed={0.3}>
              {[
                ...MARQUEE_GIFS.slice(0, 11),
                ...MARQUEE_GIFS.slice(0, 11),
                ...MARQUEE_GIFS.slice(0, 11),
              ].map((src, i) => (
                <MarqueeTile key={`r1-${i}-${src}`} src={src} />
              ))}
            </MarqueeRow>
            <MarqueeRow direction="left" speed={0.3}>
              {[
                ...MARQUEE_GIFS.slice(11),
                ...MARQUEE_GIFS.slice(11),
                ...MARQUEE_GIFS.slice(11),
              ].map((src, i) => (
                <MarqueeTile key={`r2-${i}-${src}`} src={src} />
              ))}
            </MarqueeRow>
          </div>
        </section>

        {/* ================== 3. ABOUT ================== */}
        <section
          id="about"
          className="relative flex min-h-screen flex-col items-center justify-center gap-10 bg-[#0c0c0c] px-5 py-20 sm:gap-14 sm:px-8 md:gap-16 md:px-10"
        >
          {/* Decorative corner objects */}
          <FadeIn
            x={-80}
            y={0}
            delay={0.1}
            duration={0.9}
            className="pointer-events-none absolute left-[1%] top-[4%] sm:left-[2%] md:left-[4%]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={JACK_IMG.moon} alt="" className="w-[120px] sm:w-[160px] md:w-[210px]" />
          </FadeIn>
          <FadeIn
            x={-80}
            delay={0.25}
            duration={0.9}
            className="pointer-events-none absolute bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={JACK_IMG.threeDLeft} alt="" className="w-[100px] sm:w-[140px] md:w-[180px]" />
          </FadeIn>
          <FadeIn
            x={80}
            delay={0.15}
            duration={0.9}
            className="pointer-events-none absolute right-[1%] top-[4%] sm:right-[2%] md:right-[4%]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={JACK_IMG.lego} alt="" className="w-[120px] sm:w-[160px] md:w-[210px]" />
          </FadeIn>
          <FadeIn
            x={80}
            delay={0.3}
            duration={0.9}
            className="pointer-events-none absolute bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={JACK_IMG.threeDRight}
              alt=""
              className="w-[130px] sm:w-[170px] md:w-[220px]"
            />
          </FadeIn>

          <FadeIn duration={0.9}>
            <h2
              className="hero-heading text-center font-black uppercase leading-none tracking-tight"
              style={{ fontSize: "clamp(3rem, 12vw, 160px)" }}
            >
              About me
            </h2>
          </FadeIn>

          <AnimatedTextReveal
            text="Con más de cinco años de experiencia en diseño, me especializo en branding, web y experiencia de usuario. Disfruto trabajando con marcas que quieren destacar y mostrar su mejor cara. Construyamos juntos algo increíble."
            className="max-w-[640px] text-center font-medium leading-relaxed text-[#d7e2ea]"
          />
          <FadeIn>
            <ContactPill />
          </FadeIn>
        </section>

        {/* ================== 4. SERVICES (light bg) ================== */}
        <section
          id="services"
          className="rounded-t-[40px] bg-white px-5 py-20 sm:rounded-t-[50px] sm:px-8 sm:py-24 md:rounded-t-[60px] md:px-10 md:py-32"
        >
          <FadeIn>
            <h2
              className="mb-16 text-center font-black uppercase leading-none tracking-tight text-[#0c0c0c] sm:mb-20 md:mb-28"
              style={{ fontSize: "clamp(3rem, 12vw, 160px)" }}
            >
              Services
            </h2>
          </FadeIn>
          <div className="mx-auto max-w-5xl">
            {SERVICES.map((s, i) => (
              <FadeIn
                key={s.n}
                delay={i * 0.1}
                className="flex items-start gap-4 border-t border-black/15 py-8 first:border-t-0 sm:gap-8 sm:py-10 md:py-12"
              >
                <span
                  className="font-black text-[#0c0c0c]"
                  style={{ fontSize: "clamp(2.5rem, 10vw, 140px)", lineHeight: 0.9 }}
                >
                  {s.n}
                </span>
                <div className="flex flex-1 flex-col gap-3 pt-2">
                  <h3
                    className="font-medium uppercase text-[#0c0c0c]"
                    style={{ fontSize: "clamp(1rem, 2.2vw, 2.1rem)" }}
                  >
                    {s.name}
                  </h3>
                  <p
                    className="max-w-2xl font-light leading-relaxed text-[#0c0c0c]/60"
                    style={{ fontSize: "clamp(0.85rem, 1.6vw, 1.25rem)" }}
                  >
                    {s.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ================== 5. PROJECTS (sticky stack) ================== */}
        <section
          id="projects"
          className="-mt-10 rounded-t-[40px] bg-[#0c0c0c] sm:-mt-12 sm:rounded-t-[50px] md:-mt-14 md:rounded-t-[60px]"
          style={{ position: "relative", zIndex: 10 }}
        >
          <div className="px-5 pt-20 sm:px-8 sm:pt-24 md:px-10 md:pt-32">
            <FadeIn>
              <h2
                className="hero-heading mb-12 text-center font-black uppercase leading-none tracking-tight"
                style={{ fontSize: "clamp(3rem, 12vw, 160px)" }}
              >
                Project
              </h2>
            </FadeIn>
          </div>

          <div className="px-2 pb-32 sm:px-4 md:px-6">
            {JACK_PROJECTS.map((p, i) => (
              <StickyStackCard key={p.number} index={i} total={JACK_PROJECTS.length}>
                <article className="rounded-[40px] border-2 border-[#d7e2ea] bg-[#0c0c0c] p-4 sm:rounded-[50px] sm:p-6 md:rounded-[60px] md:p-8">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-baseline gap-4 sm:gap-6">
                      <span
                        className="hero-heading font-black"
                        style={{ fontSize: "clamp(2rem, 7vw, 110px)", lineHeight: 0.9 }}
                      >
                        {p.number}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-widest text-[#d7e2ea]/60">
                          {p.category}
                        </span>
                        <h3
                          className="font-medium uppercase text-[#d7e2ea]"
                          style={{ fontSize: "clamp(1rem, 2.4vw, 2rem)" }}
                        >
                          {p.name}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border-2 border-[#d7e2ea] px-6 py-2.5 text-xs font-medium uppercase tracking-widest text-[#d7e2ea] transition-colors hover:bg-[#d7e2ea]/10 sm:px-8 sm:py-3 sm:text-sm"
                    >
                      Live Project
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2 sm:gap-4">
                    <div className="col-span-2 flex flex-col gap-2 sm:gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.img1}
                        alt={`${p.name} 1`}
                        className="w-full rounded-[24px] object-cover sm:rounded-[32px] md:rounded-[40px]"
                        style={{ height: "clamp(110px, 14vw, 200px)" }}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.img2}
                        alt={`${p.name} 2`}
                        className="w-full rounded-[24px] object-cover sm:rounded-[32px] md:rounded-[40px]"
                        style={{ height: "clamp(140px, 20vw, 300px)" }}
                      />
                    </div>
                    <div className="col-span-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.img3}
                        alt={`${p.name} 3`}
                        className="h-full w-full rounded-[24px] object-cover sm:rounded-[32px] md:rounded-[40px]"
                      />
                    </div>
                  </div>
                </article>
              </StickyStackCard>
            ))}
          </div>
        </section>

        {/* ================== 6. CTA ================== */}
        <section
          id="contact"
          className="bg-[#0c0c0c] px-5 py-20 sm:px-8 sm:py-24 md:px-10 md:py-32"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
            <FadeIn>
              <h2
                className="hero-heading font-black uppercase leading-none tracking-tight"
                style={{ fontSize: "clamp(2.5rem, 9vw, 110px)" }}
              >
                Let&apos;s build something
              </h2>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p className="max-w-md text-base font-light leading-relaxed text-[#d7e2ea]/70 sm:text-lg">
                Cuéntame en qué estás trabajando. Respondo en menos de 24 horas con una propuesta
                clara.
              </p>
            </FadeIn>
            <FadeIn delay={0.2}>
              <ContactPill />
            </FadeIn>
            <p className="mt-12 text-xs uppercase tracking-widest text-[#d7e2ea]/40">
              © 2026 Jack — 3D Creator. Hecho con cariño en Barcelona.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function MarqueeTile({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className="block h-[180px] w-[280px] flex-shrink-0 rounded-2xl object-cover sm:h-[220px] sm:w-[340px] md:h-[270px] md:w-[420px]"
    />
  );
}

function ContactPill() {
  return (
    <button
      type="button"
      className="csm-contact-pill rounded-full px-8 py-3 text-xs font-medium uppercase tracking-widest text-white transition-transform hover:scale-105 sm:px-10 sm:py-3.5 sm:text-sm md:px-12 md:py-4 md:text-base"
    >
      Contact Me
    </button>
  );
}
