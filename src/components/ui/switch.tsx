"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

type Props = {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
};

export function Switch({ checked, onCheckedChange, disabled, id, ariaLabel }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
        checked ? "border-primary bg-primary" : "border-input bg-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 -translate-x-px rounded-full bg-background shadow-sm transition-transform",
          checked && "translate-x-[16px]",
        )}
      />
    </button>
  );
}
