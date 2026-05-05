/**
 * @deprecated Importar desde `@/realtime/pubsub` directamente.
 *
 * Este shim existe para no romper call-sites que importan desde
 * `@/lib/pubsub`. La implementación se movió a `src/realtime/` con
 * soporte multi-backend (Postgres LISTEN/NOTIFY, Redis, in-memory).
 */
export { subscribePubsub, publishPubsub, getPubsub } from "@/realtime/pubsub";
export type { PubsubAdapter, PubsubListener } from "@/realtime/pubsub";
