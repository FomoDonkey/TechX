import { env } from "@/env";
import type { PutOptions, PutResult, SignOptions, StorageAdapter } from "../types";

type VercelBlobModule = {
  put: (
    key: string,
    body: Buffer | Uint8Array,
    options: {
      access: "public";
      contentType?: string;
      cacheControlMaxAge?: number;
      token?: string;
    },
  ) => Promise<{ url: string; pathname: string }>;
  del: (urlOrKey: string | string[], options?: { token?: string }) => Promise<void>;
  head: (key: string, options?: { token?: string }) => Promise<{ url: string }>;
};

let cached: VercelBlobModule | null = null;
async function loadModule(): Promise<VercelBlobModule> {
  if (cached) return cached;
  try {
    cached = (await import("@vercel/blob")) as unknown as VercelBlobModule;
    return cached;
  } catch {
    throw new Error(
      "@vercel/blob no está instalado. Ejecuta `npm install @vercel/blob` o cambia STORAGE_DRIVER.",
    );
  }
}

export const vercelBlobAdapter: StorageAdapter = {
  driver: "vercel-blob",
  async put(key, body, opts: PutOptions): Promise<PutResult> {
    const mod = await loadModule();
    const result = await mod.put(key, body, {
      access: "public",
      contentType: opts.contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return { key, url: result.url, size: body.length };
  },
  async get(_key) {
    throw new Error("Vercel Blob adapter no soporta read directo; usa la URL pública.");
  },
  async delete(key) {
    const mod = await loadModule();
    await mod.del(key, { token: env.BLOB_READ_WRITE_TOKEN });
  },
  url(key) {
    return key.startsWith("http") ? key : `/${key}`;
  },
  async sign(key, _opts: SignOptions = {}) {
    return key.startsWith("http") ? key : `/${key}`;
  },
};
