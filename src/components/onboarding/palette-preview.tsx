"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type Palette = {
  primary: string;
  accent: string;
  success?: string;
  background?: string;
  foreground?: string;
};

export function PalettePreview({
  palette,
  className,
}: {
  palette: Palette;
  className?: string;
}) {
  const swatches: Array<{ name: string; value: string }> = [
    { name: "Primario", value: palette.primary },
    { name: "Acento", value: palette.accent },
    { name: "Éxito", value: palette.success ?? "oklch(0.65 0.18 165)" },
    { name: "Fondo", value: palette.background ?? "oklch(0.13 0.015 280)" },
    { name: "Texto", value: palette.foreground ?? "oklch(0.97 0.01 280)" },
  ];

  return (
    <div className={cn("grid grid-cols-5 gap-2", className)}>
      {swatches.map((s, i) => (
        <motion.div
          key={s.name}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 380, damping: 28 }}
          className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-2 text-center text-[11px]"
        >
          <div
            className="mb-1.5 h-12 w-full rounded-xl shadow-inner"
            style={{ background: s.value }}
          />
          <span className="text-muted-foreground">{s.name}</span>
        </motion.div>
      ))}
    </div>
  );
}
