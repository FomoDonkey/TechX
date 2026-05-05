"use client";

import { cn } from "@/lib/utils";
import type { PresencePeer } from "@/presence/context";
import { usePresence } from "@/presence/context";
import { useState } from "react";

type Mode =
  /** Avatars de TODO el admin (filtra otros peers visibles). */
  | { kind: "all" }
  /** Solo peers en `/admin/contenido/{entryId}`. */
  | { kind: "entry"; entryId: string }
  /** Solo peers cuya route empieza por `prefix`. */
  | { kind: "route"; prefix: string };

type Props = {
  /** Cómo filtrar peers. Default: 'all' (todos los peers en el admin). */
  mode?: Mode;
  /** Tamaño del avatar (px). Default: 24. */
  size?: number;
  /** Máximo visible antes de "+N". Default: 3. */
  max?: number;
  className?: string;
  /** Si true, muestra "follow" como acción al hacer click en un avatar. */
  followable?: boolean;
};

/**
 * Stack de avatars en miniatura para usar dentro de filas de tablas, cards de
 * kanban, items del calendario, o widgets de dashboard. Lee de
 * `usePresence()` y aplica el filtro `mode`.
 *
 * Click en avatar → con `followable`, activa following mode (navegación auto
 * a la route del peer hasta que el user lo detenga).
 */
export function PresenceStack({
  mode = { kind: "all" },
  size = 24,
  max = 3,
  className,
  followable = true,
}: Props) {
  const presence = usePresence();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  let peers: PresencePeer[];
  if (mode.kind === "entry") peers = presence.byEntry(mode.entryId);
  else if (mode.kind === "route") peers = presence.byRoute(mode.prefix);
  else peers = presence.others;

  if (peers.length === 0) return null;

  const visible = peers.slice(0, max);
  const overflow = peers.length - visible.length;

  return (
    <div className={cn("inline-flex items-center -space-x-1.5", className)}>
      {visible.map((peer, i) => (
        <button
          type="button"
          key={peer.clientId}
          onMouseEnter={() => setHoverIdx(i)}
          onMouseLeave={() => setHoverIdx(null)}
          onClick={() => {
            if (followable) presence.setFollow(peer);
          }}
          className="group relative outline-none focus-visible:z-20"
          aria-label={`${peer.user.name} (${humanRole(peer.user.role)})`}
        >
          <span
            className={cn(
              "relative inline-flex items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold leading-none text-white ring-1 ring-background transition-transform hover:z-10 hover:scale-110",
            )}
            style={{
              width: size,
              height: size,
              backgroundColor: peer.user.color,
            }}
          >
            {peer.user.avatarUrl ? (
              <span
                aria-hidden
                className="block size-full rounded-full bg-cover bg-center"
                style={{
                  backgroundImage: `url('${cssEscape(peer.user.avatarUrl)}')`,
                }}
              />
            ) : (
              <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">
                {initials(peer.user.name)}
              </span>
            )}
            {/* Punto verde "live" en la esquina inferior derecha. */}
            <span
              className="absolute -bottom-0.5 -right-0.5 block size-2 rounded-full bg-success ring-2 ring-background"
              aria-hidden
            />
          </span>
          {hoverIdx === i ? (
            <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md ring-1 ring-border">
              <span className="font-medium">{peer.user.name}</span>
              <span className="ml-1 text-muted-foreground">· {humanRole(peer.user.role)}</span>
              {followable ? <span className="ml-1.5 text-primary">· seguir</span> : null}
            </span>
          ) : null}
        </button>
      ))}
      {overflow > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-background"
          style={{ width: size, height: size }}
          aria-label={`${overflow} más`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function humanRole(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "editor":
      return "Editor";
    case "author":
      return "Autor";
    case "viewer":
      return "Lector";
    default:
      return role;
  }
}

function cssEscape(url: string): string {
  return url.replace(/[\\'"]/g, "\\$&");
}
