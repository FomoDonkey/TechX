"use client";

import type { Peer } from "@/collab/use-collab";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Props = {
  peers: Peer[];
  /** Máximo de avatars visibles antes de colapsar a "+N". */
  max?: number;
  className?: string;
  /** Callback al hacer click en un avatar — destinado al jump-to-cursor del peer. */
  onJumpToPeer?: (peer: Peer) => void;
};

/**
 * Cluster de avatars de los peers conectados al mismo entry. Muestra hasta
 * `max` avatars y un chip "+N" cuando hay más. Hover muestra nombre + rol;
 * click invoca `onJumpToPeer` (B3 lo cablea al following mode).
 */
export function PresenceAvatars({ peers, max = 4, className, onJumpToPeer }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (peers.length === 0) return null;

  const visible = peers.slice(0, max);
  const overflow = peers.length - visible.length;

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visible.map((peer, i) => (
        <button
          type="button"
          key={peer.clientId}
          onClick={() => onJumpToPeer?.(peer)}
          onMouseEnter={() => setHoverIdx(i)}
          onMouseLeave={() => setHoverIdx(null)}
          className="group relative outline-none focus-visible:z-20"
          aria-label={`Saltar al cursor de ${peer.user.name}`}
        >
          <span
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-foreground transition-transform",
              "ring-1 ring-background hover:z-10 hover:scale-110",
            )}
            style={{ backgroundColor: peer.user.color }}
          >
            {peer.user.avatarUrl ? (
              <span
                aria-hidden
                className="block size-full rounded-full bg-cover bg-center"
                style={{ backgroundImage: `url('${cssEscape(peer.user.avatarUrl)}')` }}
              />
            ) : (
              <span className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">
                {initials(peer.user.name)}
              </span>
            )}
          </span>
          {hoverIdx === i ? (
            <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md ring-1 ring-border">
              <span className="font-medium">{peer.user.name}</span>
              <span className="ml-1 text-muted-foreground">· {humanRole(peer.user.role)}</span>
            </span>
          ) : null}
        </button>
      ))}
      {overflow > 0 ? (
        <span
          className="inline-flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-background"
          aria-label={`${overflow} más editando`}
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

/** Escape de URL para `url(...)` en CSS in-line — evita inyección via avatarUrl. */
function cssEscape(url: string): string {
  return url.replace(/[\\'"]/g, "\\$&");
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
