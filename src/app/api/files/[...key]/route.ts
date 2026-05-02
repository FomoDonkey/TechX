import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { localFullPath } from "@/storage/adapters/local";
import { verifyKey } from "@/storage/sign";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SVG/HTML/JS deliberadamente fuera: serlos same-origin permite XSS.
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
};

const BLOCKED_EXTS = new Set(["svg", "html", "htm", "js", "mjs", "xml"]);

function mimeFromExt(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function extOf(key: string): string {
  return key.split(".").pop()?.toLowerCase() ?? "";
}

type Ctx = { params: Promise<{ key: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const { key: parts } = await ctx.params;
  if (!parts || parts.length === 0) return new NextResponse("Not found", { status: 404 });

  const key = parts.join("/");
  // Block traversal early.
  if (key.includes("..") || key.includes("\\") || key.includes("\0")) {
    return new NextResponse("Bad request", { status: 400 });
  }
  if (BLOCKED_EXTS.has(extOf(key))) {
    return new NextResponse("Tipo no permitido", { status: 415 });
  }

  const url = new URL(req.url);
  const sig = url.searchParams.get("sig");
  const expRaw = url.searchParams.get("exp");
  if (sig) {
    const exp = expRaw ? Number(expRaw) : undefined;
    if (!verifyKey({ key, exp }, sig)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  let absolute: string;
  try {
    absolute = localFullPath(key);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  if (!existsSync(absolute)) return new NextResponse("Not found", { status: 404 });

  const stat = statSync(absolute);
  const data = await readFile(absolute);
  const headers = new Headers({
    "Content-Type": mimeFromExt(key),
    "Content-Length": String(stat.size),
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  return new NextResponse(new Uint8Array(data), { status: 200, headers });
}
