/**
 * Helpers puros — sin "use client" para que sirvan tanto en RSC/server como
 * en cliente. `userColor` se usa en layouts server (presence provider self
 * color) y en api routes (heartbeat).
 */

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

/** Color determinístico hash(userId) → paleta. */
export function userColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length] ?? "#3b82f6";
}
