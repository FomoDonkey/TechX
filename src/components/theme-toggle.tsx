"use client";

import { Button } from "@/components/ui/button";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Cambiar tema">
        <Sun className="opacity-0" />
      </Button>
    );
  }

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label="Cambiar tema"
      title={`Tema: ${theme}`}
    >
      <Icon className="size-5" />
    </Button>
  );
}
