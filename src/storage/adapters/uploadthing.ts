import type { PutOptions, PutResult, SignOptions, StorageAdapter } from "../types";

/**
 * UploadThing usa un protocolo cliente específico (presigned URLs + UTApi).
 * Stub para arrancar. Cuando se priorice, integramos con `uploadthing/server` UTApi.
 */
export const uploadthingAdapter: StorageAdapter = {
  driver: "uploadthing",
  async put(_key, _body, _opts: PutOptions): Promise<PutResult> {
    throw new Error(
      "UploadThing adapter aún no implementado. Usa STORAGE_DRIVER=local o vercel-blob.",
    );
  },
  async get(_key) {
    throw new Error("UploadThing adapter no soporta read directo.");
  },
  async delete(_key) {
    throw new Error("UploadThing adapter no implementado.");
  },
  url(key) {
    return key;
  },
  async sign(key, _opts: SignOptions = {}) {
    return key;
  },
};
