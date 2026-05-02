import { features } from "@/env";
import { localAdapter } from "./adapters/local";
import { s3Adapter } from "./adapters/s3";
import { uploadthingAdapter } from "./adapters/uploadthing";
import { vercelBlobAdapter } from "./adapters/vercel-blob";
import type { StorageAdapter, StorageDriver } from "./types";

export type { StorageAdapter, StorageDriver, PutOptions, PutResult } from "./types";

const ADAPTERS: Record<StorageDriver, StorageAdapter> = {
  local: localAdapter,
  uploadthing: uploadthingAdapter,
  "vercel-blob": vercelBlobAdapter,
  s3: s3Adapter,
};

let cached: StorageAdapter | null = null;

export function currentStorage(): StorageAdapter {
  if (cached) return cached;
  cached = ADAPTERS[features.storageDriver];
  return cached;
}

export function storageDriver(): StorageDriver {
  return features.storageDriver;
}

/**
 * Build a storage key for a workspace asset.
 * Format: ws_{workspaceId}/{yyyy-mm}/{nanoid}.{ext}
 */
export function buildAssetKey(workspaceId: string, ext: string, id: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const cleanExt = ext.replace(/^\.+/, "").toLowerCase().slice(0, 8) || "bin";
  return `ws_${workspaceId}/${yyyy}-${mm}/${id}.${cleanExt}`;
}
