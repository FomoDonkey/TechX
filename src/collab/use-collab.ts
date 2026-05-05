"use client";

import { useEffect, useRef, useState } from "react";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { CollabProvider, type CollabUserMeta } from "./provider";

export type CollabStatus = "connecting" | "connected" | "offline";

export type Peer = {
  clientId: number;
  user: CollabUserMeta;
};

export type UseCollabResult = {
  doc: Y.Doc;
  awareness: Awareness;
  provider: CollabProvider | null;
  status: CollabStatus;
  peers: Peer[];
  /**
   * Llamado por el editor cuando tras `init` el doc está vacío y el server
   * mandó `bodyJson` desde `entries.body`. Permite sembrar el doc con la
   * versión persistida (Tiptap JSON) para clientes que abren la entry por
   * primera vez en collab.
   */
  setOnSeed: (cb: ((body: unknown) => void) | null) => void;
};

/**
 * Hook que crea un Y.Doc + Awareness + Provider para realtime collab editing.
 * Doc y Awareness se crean sincronamente para que las extensiones de Tiptap
 * (Collaboration + CollaborationCursor) puedan engancharlos en el primer render.
 * El Provider conecta el SSE en useEffect (asíncrono, post-mount).
 */
export function useCollab(opts: {
  entryId: string | null;
  user: CollabUserMeta | null;
}): UseCollabResult {
  const { entryId, user } = opts;
  // En esta app el entry se monta como página propia: cambiar de entry
  // desmonta + remonta el hook y crea doc/awareness frescos. Por eso no
  // necesitamos resetearlos cuando cambia entryId.
  const docRef = useRef<Y.Doc | null>(null);
  if (!docRef.current) docRef.current = new Y.Doc();
  const doc = docRef.current;
  const awarenessRef = useRef<Awareness | null>(null);
  if (!awarenessRef.current) awarenessRef.current = new Awareness(doc);
  const awareness = awarenessRef.current;

  const providerRef = useRef<CollabProvider | null>(null);
  const seedCbRef = useRef<((body: unknown) => void) | null>(null);
  const [status, setStatus] = useState<CollabStatus>("connecting");
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (!entryId || !user) return;
    const provider = new CollabProvider({
      entryId,
      doc,
      awareness,
      user,
      onSeedFromBody: (body) => {
        seedCbRef.current?.(body);
      },
      onStatus: (s) => setStatus(s),
    });
    providerRef.current = provider;

    const updatePeers = () => {
      const states = awareness.getStates();
      const list: Peer[] = [];
      for (const [clientId, state] of states.entries()) {
        if (clientId === doc.clientID) continue;
        const csm = (state as { csmUser?: CollabUserMeta }).csmUser;
        const fallback = (state as { user?: { name?: string; color?: string } }).user;
        if (csm) {
          list.push({ clientId, user: csm });
        } else if (fallback?.name) {
          list.push({
            clientId,
            user: {
              id: String(clientId),
              name: fallback.name,
              color: fallback.color ?? "#3b82f6",
              role: "viewer",
            },
          });
        }
      }
      setPeers(list);
    };
    awareness.on("change", updatePeers);
    updatePeers();

    return () => {
      awareness.off("change", updatePeers);
      provider.destroy();
      providerRef.current = null;
    };
  }, [entryId, user, doc, awareness]);

  // Cleanup final del Awareness cuando el hook se desmonta.
  useEffect(() => {
    return () => {
      awarenessRef.current?.destroy();
      awarenessRef.current = null;
    };
  }, []);

  return {
    doc,
    awareness,
    provider: providerRef.current,
    status,
    peers,
    setOnSeed: (cb) => {
      seedCbRef.current = cb;
    },
  };
}
