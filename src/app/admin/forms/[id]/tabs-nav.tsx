"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TabsNav({ id }: { id: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/admin/forms/${id}`, label: "Editor" },
    { href: `/admin/forms/${id}/submissions`, label: "Envíos" },
    { href: `/admin/forms/${id}/settings`, label: "Ajustes" },
    { href: `/admin/forms/${id}/embed`, label: "Embed" },
  ];
  return (
    <nav className="flex gap-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary/12 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
