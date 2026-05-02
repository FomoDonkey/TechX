"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = [
  "oklch(0.72 0.2 290)",
  "oklch(0.78 0.22 340)",
  "oklch(0.82 0.16 180)",
  "oklch(0.78 0.18 75)",
  "oklch(0.65 0.18 165)",
];

export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 1.4,
      color: COLORS[i % COLORS.length],
      rotate: Math.random() * 720 - 360,
      size: 6 + Math.random() * 8,
    }));
  }, [count]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, x: `${p.x}vw`, opacity: 0, rotate: 0 }}
          animate={{
            y: "110vh",
            opacity: [0, 1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.2, 0.7, 0.3, 1],
          }}
          className="absolute top-0 inline-block rounded-sm"
          style={{
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
