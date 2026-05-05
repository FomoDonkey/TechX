"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type PresencePeer = {
  userId: string;
  clientId: string;
  route: string;
  entryId: string | null;
  lastSeenAt: number;
  user: {
    id: string;
    name: string;
    color: string;
    role: string;
    avatarUrl?: string | null;
  };
};

export type ReactionEvent = {
  kind: "reaction.add" | "reaction.remove";
  threadId: string;
  messageId: string;
  userId: string;
  userName: string | null;
  emoji: string;
  ts: number;
};

export type PresenceCtxValue = {
  /** Map de presencia activa keyed por `clientId` (una pestaña = un slot). */
  peers: Map<string, PresencePeer>;
  /** Lista derivada filtrable (excluye al usuario actual). */
  others: PresencePeer[];
  /** Filtro: peers que están en `/admin/contenido/{entryId}`. */
  byEntry: (entryId: string) => PresencePeer[];
  /** Filtro: peers cuya route empieza por el prefix dado. */
  byRoute: (prefix: string) => PresencePeer[];
  /** Following mode — set/clear por el usuario. Cuando hay target, el provider
   * navega automáticamente al cambiar el peer de route. */
  follow: PresencePeer | null;
  setFollow: (peer: PresencePeer | null) => void;
  /**
   * Suscribe a reactions live de un thread. El SSE de presence transporta
   * tanto presence como reactions sobre el mismo canal `presence:ws:{wsId}`.
   * Devuelve un cleanup. Listener se invoca para ADD y REMOVE.
   */
  subscribeReactions: (threadId: string, fn: (ev: ReactionEvent) => void) => () => void;
};

const PresenceCtx = createContext<PresenceCtxValue | null>(null);

const HEARTBEAT_MS = 15_000;

type Props = {
  children: ReactNode;
  workspaceId: string;
  /** Usuario actual — para excluirlo de `others`. */
  selfUserId: string;
  /** Color hashed (mismo cálculo que collab/provider). */
  selfColor: string;
  selfName: string;
  selfRole: string;
  selfAvatarUrl: string | null;
};

export function PresenceProvider({
  children,
  workspaceId,
  selfUserId,
  selfColor: _selfColor,
  selfName: _selfName,
  selfRole: _selfRole,
  selfAvatarUrl: _selfAvatarUrl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [peers, setPeers] = useState<Map<string, PresencePeer>>(new Map());
  const [follow, setFollow] = useState<PresencePeer | null>(null);
  const followRef = useRef<PresencePeer | null>(null);
  followRef.current = follow;
  const reactionListenersRef = useRef<Map<string, Set<(ev: ReactionEvent) => void>>>(new Map());

  // clientId estable por pestaña — sessionStorage. Si la pestaña recarga, se mantiene
  // (mismo slot en presence_sessions, no parpadea para los demás). Si abre nueva pestaña,
  // se genera otro clientId y son slots distintos.
  const clientId = useMemo(() => {
    if (typeof window === "undefined") return "ssr";
    const KEY = "csm:presence:cid";
    let cid = window.sessionStorage.getItem(KEY);
    if (!cid) {
      cid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `cid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(KEY, cid);
    }
    return cid;
  }, []);

  // SSE conectar al stream del workspace.
  useEffect(() => {
    if (!workspaceId) return;
    const es = new EventSource("/api/admin/presence/stream");

    es.addEventListener("init", (e) => {
      try {
        const rows = JSON.parse((e as MessageEvent).data) as Array<{
          userId: string;
          clientId: string;
          route: string;
          entryId: string | null;
          lastSeenAt: number;
          user: { id: string; name: string | null; image: string | null };
        }>;
        setPeers(() => {
          const m = new Map<string, PresencePeer>();
          for (const r of rows) {
            m.set(r.clientId, {
              userId: r.userId,
              clientId: r.clientId,
              route: r.route,
              entryId: r.entryId,
              lastSeenAt: r.lastSeenAt,
              user: {
                id: r.user.id,
                name: r.user.name ?? "Editor",
                color: hashColor(r.user.id),
                role: "viewer",
                avatarUrl: r.user.image,
              },
            });
          }
          return m;
        });
      } catch {
        /* malformed */
      }
    });

    es.addEventListener("presence", (e) => {
      try {
        const raw = JSON.parse((e as MessageEvent).data) as {
          kind: "update" | "leave" | "reaction.add" | "reaction.remove";
          [k: string]: unknown;
        };

        // Reactions: dispatch a listeners por threadId; no afectan al map de peers.
        if (raw.kind === "reaction.add" || raw.kind === "reaction.remove") {
          const ev = raw as unknown as ReactionEvent;
          const set = reactionListenersRef.current.get(ev.threadId);
          if (set) {
            for (const fn of set) {
              try {
                fn(ev);
              } catch {
                /* listener crash should not affect siblings */
              }
            }
          }
          return;
        }

        const data = raw as unknown as {
          kind: "update" | "leave";
          userId: string;
          clientId: string;
          route: string;
          entryId: string | null;
          user: PresencePeer["user"];
          ts: number;
        };
        setPeers((prev) => {
          const m = new Map(prev);
          if (data.kind === "leave") {
            m.delete(data.clientId);
          } else {
            m.set(data.clientId, {
              userId: data.userId,
              clientId: data.clientId,
              route: data.route,
              entryId: data.entryId,
              lastSeenAt: data.ts,
              user: data.user,
            });
          }
          return m;
        });

        // Following mode: si estamos siguiendo a este peer y cambió de route, navegar.
        const tracking = followRef.current;
        if (
          data.kind === "update" &&
          tracking &&
          tracking.userId === data.userId &&
          tracking.route !== data.route
        ) {
          // Actualiza el target con la nueva route para mantener el follow.
          setFollow({
            ...tracking,
            route: data.route,
            entryId: data.entryId,
            lastSeenAt: data.ts,
          });
          if (data.route !== window.location.pathname) {
            router.push(data.route);
          }
        }
      } catch {
        /* ignored */
      }
    });

    return () => es.close();
  }, [workspaceId, router]);

  // Heartbeat: route → server cada HEARTBEAT_MS y al cambiar pathname.
  useEffect(() => {
    if (!pathname || !clientId || clientId === "ssr") return;
    const send = () => {
      void fetch("/api/admin/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, route: pathname }),
        keepalive: false,
      }).catch(() => {});
    };
    send();
    const t = setInterval(send, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [pathname, clientId]);

  // Leave on unload: best-effort vía sendBeacon.
  useEffect(() => {
    if (typeof window === "undefined" || clientId === "ssr") return;
    const onUnload = () => {
      try {
        const body = JSON.stringify({ clientId });
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon?.("/api/admin/presence/leave", blob);
      } catch {
        /* swallow */
      }
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [clientId]);

  const others = useMemo(
    () => Array.from(peers.values()).filter((p) => p.userId !== selfUserId),
    [peers, selfUserId],
  );

  const byEntry = useCallback(
    (entryId: string) => others.filter((p) => p.entryId === entryId),
    [others],
  );

  const byRoute = useCallback(
    (prefix: string) => others.filter((p) => p.route.startsWith(prefix)),
    [others],
  );

  const subscribeReactions = useCallback((threadId: string, fn: (ev: ReactionEvent) => void) => {
    let set = reactionListenersRef.current.get(threadId);
    if (!set) {
      set = new Set();
      reactionListenersRef.current.set(threadId, set);
    }
    set.add(fn);
    return () => {
      const cur = reactionListenersRef.current.get(threadId);
      if (!cur) return;
      cur.delete(fn);
      if (cur.size === 0) reactionListenersRef.current.delete(threadId);
    };
  }, []);

  const value: PresenceCtxValue = {
    peers,
    others,
    byEntry,
    byRoute,
    follow,
    setFollow,
    subscribeReactions,
  };

  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>;
}

export function usePresence(): PresenceCtxValue {
  const ctx = useContext(PresenceCtx);
  if (!ctx) {
    // Fallback no-op: en escenarios pre-mount o tests, cualquier consumidor obtiene
    // valores vacíos sin throw. Esto evita crashes si se usa fuera del provider.
    return {
      peers: new Map(),
      others: [],
      byEntry: () => [],
      byRoute: () => [],
      follow: null,
      setFollow: () => {},
      subscribeReactions: () => () => {},
    };
  }
  return ctx;
}

const PALETTE = [
  "#f97316",
  "#06b6d4",
  "#a855f7",
  "#22c55e",
  "#ec4899",
  "#facc15",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
];

function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length] ?? "#3b82f6";
}
