"use client";

import { type Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as Y from "yjs";

export type CollabUserMeta = {
  id: string;
  name: string;
  color: string;
  role: string;
  avatarUrl?: string;
};

export type CollabProviderOpts = {
  entryId: string;
  doc: Y.Doc;
  awareness: Awareness;
  user: CollabUserMeta;
  /**
   * Llamado tras el evento `init` para que el caller pueda sembrar el doc desde
   * `entries.body` (Tiptap JSON) sólo si NO había snapshot ni updates previos.
   */
  onSeedFromBody?: (bodyJson: unknown) => void;
  onStatus?: (status: "connecting" | "connected" | "offline") => void;
};

/**
 * Provider Y.js custom sobre SSE (server→client) + POST (client→server).
 *
 * Por qué no y-websocket: Vercel Functions no soporta WebSocket bidireccional
 * estable en serverless. SSE + POST es streaming-compatible con Fluid Compute
 * y permite tunnelar Y.js sin proceso adicional.
 *
 * Latencia esperada: 80–150ms RTT (POST → DB → NOTIFY → SSE), aceptable para CMS
 * editing. Para teams que requieran <50ms en cursors hay env opt-in `HOCUSPOCUS_URL`
 * (no implementado en F10b parte 1).
 */
export class CollabProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly clientId: string;
  private es: EventSource | null = null;
  private user: CollabUserMeta;
  private entryId: string;
  private destroyed = false;
  private updateBuffer: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private awarenessFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private onSeedFromBody?: (bodyJson: unknown) => void;
  private onStatus?: (status: "connecting" | "connected" | "offline") => void;
  private retryDelay = 1500;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private seeded = false;

  constructor(opts: CollabProviderOpts) {
    this.doc = opts.doc;
    this.entryId = opts.entryId;
    this.user = opts.user;
    this.clientId = String(this.doc.clientID);
    // Awareness viene del caller (useCollab) para que esté disponible
    // sincronamente al montar las extensiones de Tiptap (CollaborationCursor
    // necesita awareness en el `provider` opt al construir el editor).
    this.awareness = opts.awareness;
    // Dos campos separados:
    //   - `user` lo posee CollaborationCursor de Tiptap (name + color para el caret).
    //   - `csmUser` para los avatars cluster + audit + following (id, role, avatar).
    this.awareness.setLocalStateField("user", {
      name: this.user.name,
      color: this.user.color,
    });
    this.awareness.setLocalStateField("csmUser", this.user);
    this.onSeedFromBody = opts.onSeedFromBody;
    this.onStatus = opts.onStatus;

    this.doc.on("update", this.onLocalUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.flushAwarenessRemoval);
    }

    this.connect();
  }

  private connect = () => {
    if (this.destroyed) return;
    this.onStatus?.("connecting");
    this.es = new EventSource(`/api/collab/${this.entryId}/events`);

    this.es.addEventListener("connected", () => {
      this.retryDelay = 1500;
      this.onStatus?.("connected");
    });

    this.es.addEventListener("init", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as {
          snapshot: string | null;
          updates: string[];
          bodyJson: unknown;
        };
        if (payload.snapshot) {
          Y.applyUpdate(this.doc, base64ToUint8(payload.snapshot), "remote");
        }
        for (const u of payload.updates) {
          Y.applyUpdate(this.doc, base64ToUint8(u), "remote");
        }
        if (!payload.snapshot && payload.updates.length === 0 && payload.bodyJson) {
          // Primer cliente abriendo collab para este entry: sembramos desde body_json.
          this.onSeedFromBody?.(payload.bodyJson);
        }
        this.seeded = true;
        // Tras seed, broadcast nuestro awareness inicial para que otros clientes nos vean.
        this.scheduleAwarenessFlush();
      } catch {
        /* malformed init ignored */
      }
    });

    this.es.addEventListener("update", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          clientId: string;
          update: string;
        };
        if (data.clientId === this.clientId) return;
        Y.applyUpdate(this.doc, base64ToUint8(data.update), "remote");
      } catch {
        /* ignored */
      }
    });

    this.es.addEventListener("awareness", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          clientId: string;
          update: string;
        };
        if (data.clientId === this.clientId) return;
        applyAwarenessUpdate(this.awareness, base64ToUint8(data.update), "remote");
      } catch {
        /* ignored */
      }
    });

    this.es.onerror = () => {
      this.onStatus?.("offline");
      this.es?.close();
      this.es = null;
      if (this.destroyed) return;
      // Backoff exponencial cap a 30s.
      this.retryTimer = setTimeout(this.connect, this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
    };
  };

  private onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    if (!this.seeded) return; // evitar spam mientras llega init
    this.updateBuffer.push(update);
    this.scheduleFlush();
  };

  private scheduleFlush() {
    if (this.flushTimer) return;
    // 50ms de coalescing: agrupamos updates muy seguidos en un solo POST.
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushUpdates();
    }, 50);
  }

  private async flushUpdates() {
    if (this.updateBuffer.length === 0) return;
    const merged = Y.mergeUpdates(this.updateBuffer);
    this.updateBuffer = [];
    try {
      await fetch(`/api/collab/${this.entryId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: this.clientId,
          update: uint8ToBase64(merged),
        }),
        keepalive: false,
      });
    } catch {
      // En caso de fallo, lo re-empujamos al buffer para reintento.
      this.updateBuffer.unshift(merged);
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = null;
          this.flushUpdates();
        }, 2000);
      }
    }
  }

  private onAwarenessUpdate = (
    _changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === "remote") return;
    this.scheduleAwarenessFlush();
  };

  private scheduleAwarenessFlush() {
    if (this.awarenessFlushTimer) return;
    // 80ms para cursors — perceptual smoothness sin spam.
    this.awarenessFlushTimer = setTimeout(() => {
      this.awarenessFlushTimer = null;
      this.flushAwareness();
    }, 80);
  }

  private async flushAwareness() {
    const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
    try {
      await fetch(`/api/collab/${this.entryId}/awareness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: this.clientId,
          update: uint8ToBase64(update),
          user: this.user,
        }),
      });
    } catch {
      /* awareness es best-effort */
    }
  }

  /** Dispara un awareness final con localState=null para que otros clientes nos quiten. */
  private flushAwarenessRemoval = () => {
    try {
      this.awareness.setLocalState(null);
      const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
      const body = JSON.stringify({
        clientId: this.clientId,
        update: uint8ToBase64(update),
        user: this.user,
      });
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon?.(`/api/collab/${this.entryId}/awareness`, blob);
    } catch {
      /* swallow */
    }
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.flushAwarenessRemoval();
    this.doc.off("update", this.onLocalUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.flushAwarenessRemoval);
    }
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.awarenessFlushTimer) clearTimeout(this.awarenessFlushTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.es?.close();
    this.es = null;
    // No destruimos el `awareness` aquí — lo posee el caller (useCollab).
  }
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToBase64(u8: Uint8Array): string {
  let s = "";
  // Chunked para evitar stack overflow con buffers grandes.
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
  }
  return btoa(s);
}

// Re-export desde el módulo neutro (no "use client") para que el server
// (layout, API routes) pueda importar userColor sin tirar de este file.
export { userColor } from "./colors";
