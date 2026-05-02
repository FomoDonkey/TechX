import type { Media } from "@/db/schema";

export type MediaRow = Media;

export type MediaKind = "image" | "video" | "audio" | "doc" | "other";

export function mediaKind(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || mime.startsWith("text/")) return "doc";
  return "other";
}
