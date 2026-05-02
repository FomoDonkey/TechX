"use client";

import { Confetti } from "@/components/onboarding/confetti";
import { PalettePreview } from "@/components/onboarding/palette-preview";
import { DEFAULT_CHIPS, PromptChips } from "@/components/onboarding/prompt-chips";
import { Stepper } from "@/components/onboarding/stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidSlug, slugify } from "@/lib/slug";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, PartyPopper, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createSiteFromOnboarding } from "./_actions";

type Brand = {
  name: string;
  slug: string;
  emoji: string;
  tagline: string;
  voice?: string;
  font: "geist" | "lora" | "jetbrains";
  palette: {
    primary: string;
    accent: string;
    success?: string;
    background?: string;
    foreground?: string;
  };
};
type Category = { name: string; slug: string; emoji: string };
type Post = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  bodyMarkdown: string;
};

const STEPS = [
  { id: "prompt", label: "Idea" },
  { id: "brand", label: "Marca" },
  { id: "content", label: "Contenido" },
  { id: "done", label: "Listo" },
];

export function OnboardingWizard({ userName }: { userName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pending, startTransition] = useTransition();

  function reset() {
    setBrand(null);
    setCategories([]);
    setPosts([]);
  }

  async function generate() {
    if (!prompt.trim()) {
      toast.error("Cuéntanos qué construyes 🙂");
      return;
    }
    reset();
    setGenerating(true);
    setStep(1);

    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        body: JSON.stringify({ prompt }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const tmpBrand: Partial<Brand> = {};

      // SSE stream loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          if (!raw.trim()) continue;
          const ev = raw.match(/^event: (.+)$/m)?.[1];
          const dataLine = raw.match(/^data: (.+)$/m)?.[1];
          if (!ev || !dataLine) continue;
          const data = JSON.parse(dataLine);

          switch (ev) {
            case "brand:name":
              tmpBrand.name = data.name;
              tmpBrand.slug = data.slug;
              tmpBrand.emoji = data.emoji;
              setBrand({ ...(tmpBrand as Brand) });
              break;
            case "brand:tagline":
              tmpBrand.tagline = data.tagline;
              setBrand({ ...(tmpBrand as Brand) });
              break;
            case "brand:palette":
              tmpBrand.palette = data.palette;
              setBrand({ ...(tmpBrand as Brand) });
              break;
            case "brand:font":
              tmpBrand.font = data.font;
              setBrand({ ...(tmpBrand as Brand) });
              break;
            case "brand:done":
              setBrand(data.brand);
              break;
            case "category":
              setCategories((c) => [...c, data]);
              break;
            case "post":
              setPosts((p) => [...p, data]);
              break;
            case "done":
              break;
            case "error":
              toast.error(data.message ?? "Error generando");
              break;
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Error generando tu sitio");
    } finally {
      setGenerating(false);
    }
  }

  function next() {
    if (step === 0) {
      generate();
      return;
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }

  function finish() {
    if (!brand) return;
    startTransition(async () => {
      const result = await createSiteFromOnboarding({
        prompt,
        brand,
        categories,
        posts,
      });
      if (!result.ok) {
        toast.error("No se pudo crear el workspace");
        return;
      }
      toast.success("¡Tu CMS está listo!");
      setStep(3);
      setTimeout(() => {
        router.push("/admin");
      }, 1800);
    });
  }

  function pickChip(text: string) {
    setPrompt(text);
  }

  function updateBrandSlug(value: string) {
    if (!brand) return;
    setBrand({ ...brand, slug: slugify(value) });
  }

  const slugInvalid = brand && !isValidSlug(brand.slug);

  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_15%_15%,oklch(from_var(--brand-1)_l_c_h_/_0.3),transparent),radial-gradient(50%_60%_at_85%_30%,oklch(from_var(--brand-2)_l_c_h_/_0.28),transparent),radial-gradient(60%_60%_at_50%_100%,oklch(from_var(--brand-3)_l_c_h_/_0.22),transparent)]" />
      </div>

      {step === 3 ? <Confetti /> : null}

      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10">
        <div className="mb-8">
          <Stepper steps={STEPS} current={step} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="glass flex-1 rounded-3xl p-7 shadow-[0_24px_80px_-30px_oklch(from_var(--brand-1)_l_c_h_/_0.5)]"
          >
            {step === 0 ? (
              <PromptStep
                userName={userName}
                value={prompt}
                onChange={setPrompt}
                onPick={(c) => pickChip(c.prompt)}
                onSubmit={next}
              />
            ) : null}

            {step === 1 ? (
              <BrandStep
                brand={brand}
                generating={generating}
                slugInvalid={Boolean(slugInvalid)}
                onSlugChange={updateBrandSlug}
                onBack={() => {
                  setStep(0);
                  reset();
                }}
                onNext={() => setStep(2)}
              />
            ) : null}

            {step === 2 ? (
              <ContentStep
                brand={brand}
                categories={categories}
                posts={posts}
                generating={generating}
                pending={pending}
                onBack={() => setStep(1)}
                onFinish={finish}
              />
            ) : null}

            {step === 3 ? <DoneStep brandName={brand?.name ?? ""} /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function PromptStep({
  userName,
  value,
  onChange,
  onPick,
  onSubmit,
}: {
  userName: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (chip: { prompt: string }) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Hola {userName.split(" ")[0]} ✨
      </p>
      <h2 className="mt-2 text-balance font-display text-3xl font-bold leading-tight md:text-4xl">
        ¿Qué vamos a publicar?
      </h2>
      <p className="mt-2 text-muted-foreground">
        Cuéntalo en una frase. Generaremos nombre, paleta, fuente, categorías y 3 posts demo para
        que arranques con todo listo.
      </p>

      <div className="mt-6 space-y-3">
        <Label htmlFor="prompt">Tu idea</Label>
        <Textarea
          id="prompt"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Un blog de cocina vegana con tono cercano…"
          autoFocus
        />
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            O empieza con un ejemplo:
          </p>
          <PromptChips onPick={onPick} chips={DEFAULT_CHIPS} />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          variant="gradient"
          size="lg"
          className="rounded-xl"
          disabled={value.trim().length < 4}
          onClick={onSubmit}
        >
          <Wand2 className="size-4" />
          Generar mi sitio
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function BrandStep({
  brand,
  generating,
  slugInvalid,
  onSlugChange,
  onBack,
  onNext,
}: {
  brand: Brand | null;
  generating: boolean;
  slugInvalid: boolean;
  onSlugChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const ready = !generating && brand?.palette && brand.tagline;
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Tu marca</p>
      <h2 className="mt-2 font-display text-3xl font-bold leading-tight">
        Generando tu identidad…
      </h2>

      <div className="mt-6 space-y-4">
        <Field label="Nombre" loading={!brand?.name}>
          {brand?.name ? (
            <span className="text-2xl font-semibold">
              <span className="mr-2">{brand.emoji}</span>
              {brand.name}
            </span>
          ) : null}
        </Field>

        <Field label="Tagline" loading={!brand?.tagline}>
          {brand?.tagline ? <p className="text-pretty">{brand.tagline}</p> : null}
        </Field>

        <Field label="Paleta OKLCH" loading={!brand?.palette}>
          {brand?.palette ? <PalettePreview palette={brand.palette} /> : null}
        </Field>

        <Field label="Fuente" loading={!brand?.font}>
          {brand?.font ? (
            <span
              className="text-lg"
              style={{
                fontFamily:
                  brand.font === "lora"
                    ? "Lora, ui-serif"
                    : brand.font === "jetbrains"
                      ? "var(--font-mono), ui-monospace"
                      : "var(--font-sans)",
              }}
            >
              {brand.font === "lora"
                ? "Lora — editorial"
                : brand.font === "jetbrains"
                  ? "JetBrains Mono — técnico"
                  : "Geist Sans — moderno"}
            </span>
          ) : null}
        </Field>

        {brand ? (
          <div className="space-y-2">
            <Label htmlFor="slug">URL del workspace</Label>
            <div className="flex items-center gap-2 rounded-xl border bg-background/50 px-3 backdrop-blur">
              <span className="text-sm text-muted-foreground">csm.app/</span>
              <Input
                id="slug"
                value={brand.slug}
                onChange={(e) => onSlugChange(e.target.value)}
                className="border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            {slugInvalid ? (
              <p className="text-xs text-destructive">
                Usa solo minúsculas, números y guiones (2-48 caracteres).
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={generating}>
          ← Volver
        </Button>
        <Button
          variant="gradient"
          size="lg"
          className="rounded-xl"
          disabled={!ready || slugInvalid}
          onClick={onNext}
        >
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Siguiente <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ContentStep({
  brand,
  categories,
  posts,
  generating,
  pending,
  onBack,
  onFinish,
}: {
  brand: Brand | null;
  categories: Category[];
  posts: Post[];
  generating: boolean;
  pending: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Contenido inicial</p>
      <h2 className="mt-2 font-display text-3xl font-bold leading-tight">
        Cinco categorías. Tres entradas. Listas para editar.
      </h2>

      <div className="mt-6 space-y-6">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Categorías</p>
          <div className="flex flex-wrap gap-2">
            {categories.length === 0
              ? ["a", "b", "c", "d", "e"].map((k) => (
                  <span key={k} className="h-7 w-24 animate-pulse rounded-full bg-muted/50" />
                ))
              : categories.map((c) => (
                  <span
                    key={c.slug}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-sm"
                  >
                    <span aria-hidden>{c.emoji}</span>
                    {c.name}
                  </span>
                ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Posts demo</p>
          <ul className="space-y-2">
            {posts.length === 0
              ? ["a", "b", "c"].map((k) => (
                  <li key={k} className="h-16 animate-pulse rounded-2xl bg-muted/40" />
                ))
              : posts.map((p) => (
                  <motion.li
                    key={p.slug}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border bg-card/40 p-4 backdrop-blur"
                  >
                    <p className="font-medium">{p.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{p.excerpt}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Categoría · {p.category}
                    </p>
                  </motion.li>
                ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          ← Volver
        </Button>
        <Button
          variant="gradient"
          size="lg"
          className="rounded-xl"
          disabled={generating || pending || !brand}
          onClick={onFinish}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Crear mi CMS
        </Button>
      </div>
    </div>
  );
}

function DoneStep({ brandName }: { brandName: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="grid size-20 place-items-center rounded-full bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-white shadow-[0_20px_60px_-15px_oklch(from_var(--brand-1)_l_c_h_/_0.7)]"
      >
        <PartyPopper className="size-10" />
      </motion.div>
      <h2 className="mt-6 font-display text-3xl font-bold">¡{brandName} está vivo!</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Te llevamos al admin para que escribas tu primer post de verdad.
      </p>
    </div>
  );
}

function Field({
  label,
  loading,
  children,
}: {
  label: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? <div className="h-6 w-3/4 animate-pulse rounded-md bg-muted/40" /> : children}
    </div>
  );
}
