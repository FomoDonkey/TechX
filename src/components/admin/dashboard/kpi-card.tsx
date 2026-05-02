import { Sparkline } from "@/components/admin/dashboard/sparkline";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: number | string;
  hint?: string;
  series: number[];
  icon: LucideIcon;
  accent?: "primary" | "accent" | "brand-3";
  format?: (n: number) => string;
};

function defaultFormat(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("es-ES");
}

function trend(series: number[]) {
  if (series.length < 4) return { delta: 0, dir: "flat" as const, pct: 0 };
  const half = Math.floor(series.length / 2);
  const a = series.slice(0, half).reduce((s, n) => s + n, 0);
  const b = series.slice(half).reduce((s, n) => s + n, 0);
  const delta = b - a;
  const pct = a === 0 ? (b === 0 ? 0 : 100) : Math.round(((b - a) / Math.max(a, 1)) * 100);
  const dir = delta > 0 ? ("up" as const) : delta < 0 ? ("down" as const) : ("flat" as const);
  return { delta, dir, pct };
}

export function KpiCard({
  label,
  value,
  hint,
  series,
  icon: Icon,
  accent = "primary",
  format,
}: Props) {
  const t = trend(series);
  const TrendIcon = t.dir === "up" ? ArrowUp : t.dir === "down" ? ArrowDown : ArrowRight;
  const trendClass =
    t.dir === "up"
      ? "text-success"
      : t.dir === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  const accentVar =
    accent === "accent"
      ? "var(--accent)"
      : accent === "brand-3"
        ? "var(--brand-3)"
        : "var(--primary)";
  const display = typeof value === "number" ? (format ?? defaultFormat)(value) : value;

  return (
    <Card className="group relative overflow-hidden p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className="grid size-7 place-items-center rounded-lg"
            style={{ background: `oklch(from ${accentVar} l c h / 0.15)`, color: accentVar }}
          >
            <Icon className="size-3.5" />
          </span>
          {label}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
            trendClass,
          )}
        >
          <TrendIcon className="size-3" />
          {Math.abs(t.pct)}%
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-display text-3xl font-semibold tabular-nums leading-none">{display}</p>
        <div className="w-24 text-[color:var(--accent-color)]" style={{ color: accentVar }}>
          <Sparkline series={series} fill={accentVar} stroke={accentVar} />
        </div>
      </div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
