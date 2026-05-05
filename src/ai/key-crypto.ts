/**
 * Encriptación at-rest para API keys de proveedores AI guardadas en BD.
 *
 * Algoritmo: AES-256-GCM con IV de 12 bytes (recomendado para GCM) y
 * authentication tag de 16 bytes. La key de encryption se deriva de
 * `AUTH_SECRET` via HKDF-SHA256 con info-string fija "csm-ai-keys".
 *
 * Formato de salida (base64): `iv (12) | ciphertext (var) | tag (16)`.
 *
 * Garantías:
 * - Confidencialidad: alguien con acceso a la BD pero sin AUTH_SECRET no
 *   puede descifrar las keys.
 * - Integridad: GCM tag detecta cualquier modificación del ciphertext.
 * - Rotación: cambiar AUTH_SECRET invalida todas las keys (los workspaces
 *   tendrán que re-introducirlas — es un trade-off consciente vs key versioning).
 *
 * NO usa key versioning ni multi-tenant key derivation por simplicidad.
 * Si en el futuro queremos rotación sin invalidar, se añade `keyVersion`
 * al output y `deriveKey(version)` con HKDF info distinto.
 */

import { env } from "@/env";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HKDF_INFO = "csm-ai-keys";

function deriveKey(): Buffer {
  // hkdfSync(digest, ikm, salt, info, length) — devuelve un ArrayBuffer.
  return Buffer.from(
    hkdfSync("sha256", env.AUTH_SECRET, Buffer.alloc(0), HKDF_INFO, KEY_BYTES),
  );
}

/**
 * Encripta una API key (u otro string sensible) y devuelve un blob
 * base64-encoded listo para guardar en BD. Acepta strings vacíos
 * (devuelve "" — útil para "borrar" la key sin null en columna NOT NULL).
 */
export function encryptKey(plaintext: string): string {
  if (!plaintext) return "";
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

/**
 * Decripta un blob previamente generado por `encryptKey`. Devuelve null si
 * el blob está vacío, mal formado, o el tag GCM no valida (BD modificada).
 *
 * Importante: nunca propagamos el error real fuera para evitar oracle de
 * decryption — solo retornamos null y dejamos que el caller fallback.
 */
export function decryptKey(encoded: string): string | null {
  if (!encoded) return null;
  try {
    const buf = Buffer.from(encoded, "base64");
    if (buf.length < IV_BYTES + TAG_BYTES + 1) return null;
    const iv = buf.subarray(0, IV_BYTES);
    const tag = buf.subarray(buf.length - TAG_BYTES);
    const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
    const key = deriveKey();
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
