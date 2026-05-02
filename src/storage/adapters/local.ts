import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";
import { signKey } from "../sign";
import type { PutOptions, PutResult, SignOptions, StorageAdapter } from "../types";

function rootDir(): string {
  const dir = env.STORAGE_LOCAL_DIR;
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

function safeKey(key: string): string {
  // Prevent path traversal: no ".." segments and no leading slash escapes.
  const cleaned = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return cleaned;
}

function fullPath(key: string): string {
  return path.join(rootDir(), safeKey(key));
}

function publicUrl(key: string): string {
  return `/api/files/${safeKey(key)}`;
}

export const localAdapter: StorageAdapter = {
  driver: "local",
  async put(key, body, _opts: PutOptions): Promise<PutResult> {
    const filePath = fullPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return {
      key: safeKey(key),
      url: publicUrl(key),
      size: body.length,
    };
  },
  async get(key) {
    try {
      return await readFile(fullPath(key));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "ENOENT") return null;
      throw err;
    }
  },
  async delete(key) {
    await rm(fullPath(key), { force: true });
  },
  url(key) {
    return publicUrl(key);
  },
  async sign(key, opts: SignOptions = {}) {
    const exp = opts.expiresIn ? Date.now() + opts.expiresIn * 1000 : undefined;
    const sig = signKey({ key: safeKey(key), exp });
    const params = new URLSearchParams({ sig });
    if (exp) params.set("exp", String(exp));
    return `${publicUrl(key)}?${params.toString()}`;
  },
};

export function localFullPath(key: string): string {
  return fullPath(key);
}
