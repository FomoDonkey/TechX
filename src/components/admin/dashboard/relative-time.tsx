"use client";

import { useEffect, useState } from "react";

const RTF =
  typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("es", { numeric: "auto" }) : null;
const FMT =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" })
    : null;

function format(date: Date) {
  if (!RTF) return date.toISOString();
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return RTF.format(diffSec, "second");
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return RTF.format(Math.round(diffSec / 86400), "day");
  return FMT?.format(date) ?? date.toISOString();
}

export function RelativeTime({
  date,
  prefix,
  className,
}: {
  date: string | Date;
  prefix?: string;
  className?: string;
}) {
  const d = date instanceof Date ? date : new Date(date);
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (Number.isNaN(d.getTime())) {
    return <span className={className}>—</span>;
  }

  const label = format(d);
  return (
    <time dateTime={d.toISOString()} title={FMT?.format(d) ?? label} className={className}>
      {prefix ? `${prefix} ${label}` : label}
    </time>
  );
}
