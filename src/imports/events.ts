/**
 * Event bus por importId — el engine emite, el SSE endpoint suscribe.
 * In-memory; si la dyno se reinicia durante un run, los suscriptores SSE
 * abiertos se cortan pero el engine sigue (escribe estado a DB). El cliente
 * reconecta y lee estado de DB para reconciliar.
 *
 * Limitación conocida: no funciona en deploys multi-instancia. Para v1
 * (Vercel + Fluid Compute con instance reuse) es suficiente. F10 mover a
 * pub/sub (Redis o Vercel Queues) si se hace edge.
 */

import type { ImportProgressEvent } from "./types";

type Listener = (ev: ImportProgressEvent) => void;

const buses = new Map<string, Set<Listener>>();
const buffers = new Map<string, ImportProgressEvent[]>();
const BUFFER_CAP = 200;

export function emit(importId: string, ev: ImportProgressEvent): void {
  // Buffer to allow late subscribers (SSE conecta después de POST /run) to catch up
  const buf = buffers.get(importId) ?? [];
  buf.push(ev);
  if (buf.length > BUFFER_CAP) buf.splice(0, buf.length - BUFFER_CAP);
  buffers.set(importId, buf);

  const listeners = buses.get(importId);
  if (!listeners) return;
  for (const l of listeners) {
    try {
      l(ev);
    } catch {
      // listener crashes don't break the engine
    }
  }
}

export function subscribe(importId: string, listener: Listener): () => void {
  let listeners = buses.get(importId);
  if (!listeners) {
    listeners = new Set();
    buses.set(importId, listeners);
  }
  listeners.add(listener);

  // Replay buffer
  const buf = buffers.get(importId);
  if (buf) {
    for (const ev of buf) {
      try {
        listener(ev);
      } catch {}
    }
  }

  return () => {
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) buses.delete(importId);
  };
}

export function clearImport(importId: string): void {
  buses.delete(importId);
  buffers.delete(importId);
}
