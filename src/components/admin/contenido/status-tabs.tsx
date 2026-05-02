import { cn } from "@/lib/utils";
import Link from "next/link";

const TABS: Array<{
  key: "all" | "draft" | "review" | "scheduled" | "published" | "archived";
  label: string;
}> = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Borradores" },
  { key: "review", label: "Revisión" },
  { key: "scheduled", label: "Programados" },
  { key: "published", label: "Publicados" },
  { key: "archived", label: "Archivados" },
];

export function StatusTabs({
  current,
  counts,
  q,
  basePath = "/admin/contenido",
}: {
  current: (typeof TABS)[number]["key"];
  counts: Record<(typeof TABS)[number]["key"], number>;
  q?: string;
  basePath?: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-card/30 p-1 backdrop-blur">
      {TABS.map((tab) => {
        const active = tab.key === current;
        const params = new URLSearchParams();
        if (tab.key !== "all") params.set("status", tab.key);
        if (q) params.set("q", q);
        const href = params.toString() ? `${basePath}?${params.toString()}` : basePath;
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            scroll={false}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {counts[tab.key]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
