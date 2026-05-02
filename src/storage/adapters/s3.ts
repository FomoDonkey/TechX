import { env } from "@/env";
import type { PutOptions, PutResult, SignOptions, StorageAdapter } from "../types";

type S3ClientLike = {
  send: (cmd: unknown) => Promise<unknown>;
};

type S3Module = {
  S3Client: new (cfg: {
    region?: string;
    credentials: { accessKeyId: string; secretAccessKey: string };
  }) => S3ClientLike;
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  GetObjectCommand: new (input: Record<string, unknown>) => unknown;
  DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
};

type PresignerModule = {
  getSignedUrl: (
    client: S3ClientLike,
    cmd: unknown,
    options: { expiresIn: number },
  ) => Promise<string>;
};

let cachedClient: { client: S3ClientLike; mod: S3Module; presigner: PresignerModule } | null = null;
async function load() {
  if (cachedClient) return cachedClient;
  let mod: S3Module;
  let presigner: PresignerModule;
  try {
    mod = (await import("@aws-sdk/client-s3")) as unknown as S3Module;
    presigner = (await import("@aws-sdk/s3-request-presigner")) as unknown as PresignerModule;
  } catch {
    throw new Error(
      "Paquetes S3 no instalados: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.",
    );
  }
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
    throw new Error("Faltan credenciales AWS_* en el entorno.");
  }
  const client = new mod.S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  cachedClient = { client, mod, presigner };
  return cachedClient;
}

function publicUrl(key: string): string {
  if (env.AWS_S3_PUBLIC_URL) return `${env.AWS_S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  if (!env.AWS_S3_BUCKET) return `/${key}`;
  const region = env.AWS_REGION ?? "us-east-1";
  return `https://${env.AWS_S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

export const s3Adapter: StorageAdapter = {
  driver: "s3",
  async put(key, body, opts: PutOptions): Promise<PutResult> {
    const { client, mod } = await load();
    await client.send(
      new mod.PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: opts.contentType,
        CacheControl: opts.cacheControl,
        ACL: "public-read",
      }),
    );
    return { key, url: publicUrl(key), size: body.length };
  },
  async get(_key) {
    throw new Error("S3 adapter: usa la URL pública para read.");
  },
  async delete(key) {
    const { client, mod } = await load();
    await client.send(new mod.DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
  },
  url(key) {
    return publicUrl(key);
  },
  async sign(key, opts: SignOptions = {}) {
    const { client, mod, presigner } = await load();
    const cmd = new mod.GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key });
    return presigner.getSignedUrl(client, cmd, { expiresIn: opts.expiresIn ?? 3600 });
  },
};
