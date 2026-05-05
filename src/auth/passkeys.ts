import { db } from "@/db/client";
import { passkeys, verifications } from "@/db/schema";
import { env } from "@/env";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { and, eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Registro de Passkeys (WebAuthn) sin depender del plugin de Better-Auth.
 * Reusa la tabla `passkeys` ya en schema y la tabla `verifications` (key/value
 * con TTL) como almacén de challenges efímeros.
 */

export function getRelyingParty() {
  const url = new URL(env.NEXT_PUBLIC_APP_URL);
  return {
    rpID: url.hostname,
    rpName: "CSM",
    origin: url.origin,
  };
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min
const CHALLENGE_PREFIX_REG = "passkey_register:";
const CHALLENGE_PREFIX_AUTH = "passkey_auth:";

async function storeChallenge(prefix: string, userKey: string, challenge: string) {
  if (!db) throw new Error("db_unavailable");
  await db.insert(verifications).values({
    id: nanoid(),
    identifier: `${prefix}${userKey}`,
    value: challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
}

async function takeChallenge(prefix: string, userKey: string): Promise<string | null> {
  if (!db) return null;
  // Borra expirados oportunísticamente.
  await db.delete(verifications).where(lt(verifications.expiresAt, new Date()));
  const id = `${prefix}${userKey}`;
  const [row] = await db
    .select()
    .from(verifications)
    .where(eq(verifications.identifier, id))
    .limit(1);
  if (!row) return null;
  // Single-use: borra al consumir.
  await db.delete(verifications).where(eq(verifications.id, row.id));
  return row.value;
}

export async function generatePasskeyRegistrationOptions(user: {
  id: string;
  email: string;
  name: string;
}) {
  const { rpID, rpName } = getRelyingParty();

  const existing = db
    ? await db
        .select({ credentialID: passkeys.credentialID, transports: passkeys.transports })
        .from(passkeys)
        .where(eq(passkeys.userId, user.id))
    : [];

  const opts = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialID,
      transports: parseTransports(c.transports),
    })),
  });

  await storeChallenge(CHALLENGE_PREFIX_REG, user.id, opts.challenge);
  return opts;
}

export async function verifyPasskeyRegistration(args: {
  userId: string;
  response: unknown;
  name?: string;
}) {
  if (!db) throw new Error("db_unavailable");
  const { rpID, origin } = getRelyingParty();
  const challenge = await takeChallenge(CHALLENGE_PREFIX_REG, args.userId);
  if (!challenge) throw new Error("challenge_expired");

  const verification = await verifyRegistrationResponse({
    response: args.response as never,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("verification_failed");
  }

  const info = verification.registrationInfo;
  const credential = info.credential;
  const credentialId = credential.id;
  const credentialPublicKey = credential.publicKey;
  const counter = credential.counter;
  const credentialDeviceType = info.credentialDeviceType;
  const credentialBackedUp = info.credentialBackedUp;

  const transports = (
    (args.response as { response?: { transports?: string[] } })?.response?.transports ?? []
  ).join(",");

  const id = nanoid();
  await db.insert(passkeys).values({
    id,
    name: args.name?.trim() || `Passkey ${new Date().toLocaleDateString("es-ES")}`,
    publicKey: bytesToBase64(credentialPublicKey),
    userId: args.userId,
    credentialID: credentialId,
    counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: transports || null,
  });

  return { id, verified: true };
}

export async function generatePasskeyAuthenticationOptions(args: {
  /** Si conocemos el user (por email previo en login), pasamos su id; si no, allow=any. */
  userId?: string;
}) {
  const { rpID } = getRelyingParty();
  let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] | undefined;
  if (args.userId && db) {
    const list = await db
      .select({ credentialID: passkeys.credentialID, transports: passkeys.transports })
      .from(passkeys)
      .where(eq(passkeys.userId, args.userId));
    allowCredentials = list.map((c) => ({
      id: c.credentialID,
      transports: parseTransports(c.transports),
    }));
  }
  const opts = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });
  // Para auth pre-login no tenemos userId estable; usamos el challenge como key.
  await storeChallenge(CHALLENGE_PREFIX_AUTH, args.userId ?? opts.challenge, opts.challenge);
  return opts;
}

export async function verifyPasskeyAuthentication(args: {
  response: unknown;
  /** Si lo conoces, mejora seguridad. */
  userId?: string;
}): Promise<{ userId: string; verified: true }> {
  if (!db) throw new Error("db_unavailable");
  const { rpID, origin } = getRelyingParty();
  const credId = (args.response as { id?: string })?.id;
  if (!credId) throw new Error("missing_credential_id");

  const [pk] = await db.select().from(passkeys).where(eq(passkeys.credentialID, credId)).limit(1);
  if (!pk) throw new Error("unknown_credential");
  if (args.userId && pk.userId !== args.userId) throw new Error("user_mismatch");

  // Resolver la key del challenge:
  // - Si conocemos el userId previo (passkey desde sesión activa) → key = userId
  // - Si no (login con resident credential): el browser envía el challenge
  //   original en `clientDataJSON.challenge` (base64url). Lo extraemos y lo
  //   usamos como key — debe coincidir con cómo lo guardamos en
  //   `generatePasskeyAuthenticationOptions` (key = `opts.challenge` cuando
  //   no había userId).
  const challengeKey = args.userId ?? extractClientDataChallenge(args.response);
  if (!challengeKey) throw new Error("missing_challenge_key");
  const challenge = await takeChallenge(CHALLENGE_PREFIX_AUTH, challengeKey);
  if (!challenge) throw new Error("challenge_expired");

  const publicKeyBytes = base64ToBytes(pk.publicKey);
  const verification = await verifyAuthenticationResponse({
    response: args.response as never,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    // simplewebauthn requiere `Uint8Array<ArrayBuffer>` estricto en TS 5.7+; el
    // de Node es `Uint8Array<ArrayBufferLike>`. Cast explícito tras detach copy.
    credential: {
      id: pk.credentialID,
      publicKey: publicKeyBytes as unknown as Uint8Array<ArrayBuffer>,
      counter: pk.counter,
      transports: parseTransports(pk.transports),
    },
    requireUserVerification: false,
  });

  if (!verification.verified) throw new Error("verification_failed");

  await db
    .update(passkeys)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(passkeys.id, pk.id));

  return { userId: pk.userId, verified: true };
}

export async function listUserPasskeys(userId: string) {
  if (!db) return [];
  return db
    .select({
      id: passkeys.id,
      name: passkeys.name,
      deviceType: passkeys.deviceType,
      backedUp: passkeys.backedUp,
      transports: passkeys.transports,
      createdAt: passkeys.createdAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, userId));
}

export async function deletePasskey(args: { userId: string; passkeyId: string }) {
  if (!db) throw new Error("db_unavailable");
  await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, args.passkeyId), eq(passkeys.userId, args.userId)));
}

export async function renamePasskey(args: {
  userId: string;
  passkeyId: string;
  name: string;
}) {
  if (!db) throw new Error("db_unavailable");
  const trimmed = args.name.trim().slice(0, 80);
  if (!trimmed) throw new Error("invalid_name");
  await db
    .update(passkeys)
    .set({ name: trimmed })
    .where(and(eq(passkeys.id, args.passkeyId), eq(passkeys.userId, args.userId)));
}

/**
 * Lee `clientDataJSON` de la respuesta WebAuthn y devuelve el challenge en
 * base64url. Para el flow de resident credential — donde no conocemos al user
 * cuando se generan las opciones — el challenge se almacena bajo su propio
 * valor; en verify lo recuperamos desde el clientDataJSON enviado por el
 * authenticator. Si la respuesta es malformada devolvemos null.
 */
function extractClientDataChallenge(response: unknown): string | null {
  try {
    const r = response as { response?: { clientDataJSON?: string } };
    const cd = r?.response?.clientDataJSON;
    if (!cd) return null;
    // base64url → bytes → utf-8 string → JSON.challenge
    const padded = cd
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(cd.length / 4) * 4, "=");
    const bin = atob(padded);
    let txt = "";
    for (let i = 0; i < bin.length; i++) txt += String.fromCharCode(bin.charCodeAt(i));
    const parsed = JSON.parse(txt) as { challenge?: string };
    return parsed.challenge ?? null;
  } catch {
    return null;
  }
}

function parseTransports(s: string | null): AuthenticatorTransport[] | undefined {
  if (!s) return undefined;
  // `AuthenticatorTransport` lib.dom no incluye `cable` ni `smart-card` aún en
  // 2026; los aceptamos via cast. Spec: WebAuthn L3.
  const valid = new Set(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
  const arr = s
    .split(",")
    .map((t) => t.trim())
    .filter((t) => valid.has(t)) as AuthenticatorTransport[];
  return arr.length ? arr : undefined;
}

function bytesToBase64(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i] ?? 0);
  return btoa(bin);
}

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
