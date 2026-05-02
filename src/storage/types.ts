export type StorageDriver = "local" | "uploadthing" | "vercel-blob" | "s3";

export type PutOptions = {
  contentType: string;
  cacheControl?: string;
};

export type PutResult = {
  key: string;
  url: string;
  size: number;
};

export type SignOptions = {
  /** Expiry in seconds. */
  expiresIn?: number;
};

export type StorageAdapter = {
  driver: StorageDriver;
  put(key: string, body: Buffer | Uint8Array, opts: PutOptions): Promise<PutResult>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Public URL (no auth). */
  url(key: string): string;
  /** Signed URL when private access is required. */
  sign(key: string, opts?: SignOptions): Promise<string>;
};
