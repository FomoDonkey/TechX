"use client";

import { cn } from "@/lib/utils";

export type PromptChip = {
  emoji: string;
  label: string;
  prompt: string;
};

export const DEFAULT_CHIPS: PromptChip[] = [
  {
    emoji: "🥬",
    label: "Blog cocina vegana",
    prompt:
      "Un blog de recetas veganas con tono cercano, vegetales de temporada y guías para principiantes.",
  },
  {
    emoji: "🤖",
    label: "Newsletter de IA",
    prompt:
      "Una newsletter semanal sobre lanzamientos de IA en español, con análisis técnico claro.",
  },
  {
    emoji: "📷",
    label: "Portfolio fotógrafa",
    prompt: "Portfolio de fotografía editorial y de moda, minimalista, con series temáticas.",
  },
  {
    emoji: "📚",
    label: "Docs SaaS",
    prompt: "Documentación de un SaaS de analítica, con guías rápidas, API reference y changelog.",
  },
];

export function PromptChips({
  chips = DEFAULT_CHIPS,
  onPick,
  disabled,
}: {
  chips?: PromptChip[];
  onPick: (chip: PromptChip) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c)}
          disabled={disabled}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1.5 text-sm backdrop-blur transition-all",
            "hover:border-primary/50 hover:bg-primary/10 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <span aria-hidden>{c.emoji}</span>
          <span className="font-medium">{c.label}</span>
        </button>
      ))}
    </div>
  );
}
