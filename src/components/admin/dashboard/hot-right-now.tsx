"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePresence } from "@/presence/context";
import { Flame } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

/**
 * Widget único en CMS open-source 2026: muestra entries con mayor concurrencia
 * editorial **AHORA**, agrupados por entryId. Usa el mismo presence stream
 * global que alimenta los avatars del admin. Si no hay nadie editando, no
 * renderiza (evita widget vacío sin información).
 */
export function HotRightNow() {
  const { others } = usePresence();

  const groups = useMemo(() => {
    const byEntry = new Map<
      string,
      {
        entryId: string;
        peers: typeof others;
        latestRoute: string;
      }
    >();
    for (const p of others) {
      if (!p.entryId) continue;
      const cur = byEntry.get(p.entryId);
      if (cur) {
        cur.peers.push(p);
      } else {
        byEntry.set(p.entryId, {
          entryId: p.entryId,
          peers: [p],
          latestRoute: p.route,
        });
      }
    }
    return Array.from(byEntry.values()).sort((a, b) => b.peers.length - a.peers.length);
  }, [others]);

  if (groups.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-amber-500" />
        <h3 className="font-display text-base font-semibold">En vivo ahora</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {groups.length} {groups.length === 1 ? "entrada activa" : "entradas activas"}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {groups.slice(0, 5).map((g) => (
          <li key={g.entryId}>
            <Link
              href={g.latestRoute}
              className="group flex items-center gap-3 rounded-lg border bg-card/40 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-card/80"
            >
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-[11px] font-bold text-white shadow-sm",
                  g.peers.length >= 3 && "ring-2 ring-amber-400/40",
                )}
              >
                {g.peers.length}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {g.peers
                    .slice(0, 3)
                    .map((p) => p.user.name)
                    .join(", ")}
                  {g.peers.length > 3 ? ` y ${g.peers.length - 3} más` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">{g.latestRoute}</p>
              </div>
              <div className="-space-x-1 flex">
                {g.peers.slice(0, 4).map((p) => (
                  <span
                    key={p.clientId}
                    title={p.user.name}
                    className="inline-flex size-5 items-center justify-center rounded-full border-2 border-background text-[9px] font-bold text-white ring-1 ring-background"
                    style={{ backgroundColor: p.user.color }}
                  >
                    {initials(p.user.name)}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
