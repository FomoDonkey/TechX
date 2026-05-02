import { cn } from "@/lib/utils";

type Props = {
  series: number[];
  className?: string;
  stroke?: string;
  fill?: string;
  height?: number;
  width?: number;
  showDots?: boolean;
};

export function Sparkline({
  series,
  className,
  stroke = "currentColor",
  fill,
  height = 36,
  width = 120,
  showDots = false,
}: Props) {
  const safe = series.length === 0 ? [0, 0] : series;
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(safe.length - 1, 1);

  const points = safe.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    fill && points.length > 1
      ? `${path} L ${(points.at(-1)?.[0] ?? width).toFixed(2)} ${height} L 0 ${height} Z`
      : null;

  return (
    <svg
      role="img"
      aria-label="Tendencia"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
    >
      <title>Tendencia 14 días</title>
      {areaPath && fill ? <path d={areaPath} fill={fill} opacity={0.18} /> : null}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots
        ? points.map(([x, y], i) => (
            <circle key={`pt-${i}-${x.toFixed(0)}`} cx={x} cy={y} r={1.6} fill={stroke} />
          ))
        : null}
    </svg>
  );
}
