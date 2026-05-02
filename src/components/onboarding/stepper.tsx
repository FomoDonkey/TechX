"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function Stepper({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: number;
}) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-3">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-all",
                done && "border-primary bg-primary text-primary-foreground",
                active &&
                  "border-primary bg-primary/15 text-primary shadow-[0_0_24px_oklch(from_var(--primary)_l_c_h_/_0.4)]",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-sm font-medium md:inline-block",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span
                className={cn("h-px flex-1 transition-colors", done ? "bg-primary" : "bg-border")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
