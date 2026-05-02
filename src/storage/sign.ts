import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

const ALGO = "sha256";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export type StorageSignaturePayload = {
  key: string;
  exp?: number;
};

export function signKey(payload: StorageSignaturePayload): string {
  const exp = payload.exp ?? "";
  const data = `${payload.key}|${exp}`;
  const mac = createHmac(ALGO, env.STORAGE_SIGNING_SECRET).update(data).digest();
  return base64url(mac);
}

export function verifyKey(payload: StorageSignaturePayload, sig: string): boolean {
  if (!sig) return false;
  if (payload.exp && Date.now() > payload.exp) return false;
  const expected = signKey(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
