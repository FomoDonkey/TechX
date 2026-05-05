/**
 * Pubsub adapter interface — backend-agnostic.
 *
 * Tres backends soportados:
 *  - Postgres LISTEN/NOTIFY (default si DB=Postgres y no hay REDIS_URL)
 *  - Redis pub/sub (si REDIS_URL está configurado, funciona con cualquier DB)
 *  - In-memory (fallback: single-instance only — NO fanout cross-instance)
 *
 * Los call-sites no saben qué backend están usando: `getPubsub()` resuelve
 * el adapter correcto a partir de las env vars. Los canales y payloads son
 * los mismos en todos los backends.
 */

export type PubsubListener = (payload: string) => void;

export interface PubsubAdapter {
  /**
   * Suscribe un listener a un canal. Idempotente: la primera subscripción
   * abre la conexión cross-instance; las siguientes son fanout local.
   * Devuelve un cleanup para retirar el listener.
   */
  subscribe(channel: string, fn: PubsubListener): () => void;

  /**
   * Publica un payload al canal. Best-effort: errores se swallowean.
   * El payload debe ser JSON-serializable. Postgres tiene cap de 8KB —
   * mantener payloads pequeños (Y.js updates típicos < 1KB).
   */
  publish(channel: string, payload: unknown): Promise<void>;

  /** Identificador del backend (para diagnostics/logs). */
  readonly kind: "postgres" | "redis" | "memory";
}
