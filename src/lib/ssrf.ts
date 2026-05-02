import { lookup } from "node:dns/promises";

/**
 * Bloquea direcciones IP privadas, loopback, link-local y metadata cloud para
 * prevenir SSRF cuando el server hace fetch a URLs proporcionadas por usuarios.
 */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a = 0, b = 0] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
  if (
    lower.startsWith("fe80") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  )
    return true; // fe80::/10
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6
    const mapped = lower.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) return isBlockedIPv4(mapped);
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.gce.cluster.local",
]);

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http(s)");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("Host no permitido");
  }
  // If host is a literal IP, validate directly without DNS.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isBlockedIPv4(host)) throw new Error("IP no permitida");
    return url;
  }
  if (host.includes(":") || host.startsWith("[")) {
    const ip = host.replace(/^\[|\]$/g, "");
    if (isBlockedIPv6(ip)) throw new Error("IP no permitida");
    return url;
  }
  // Otherwise resolve and check both A/AAAA.
  try {
    const records = await lookup(host, { all: true });
    for (const r of records) {
      if (r.family === 4 && isBlockedIPv4(r.address)) throw new Error("Host resuelve a IP privada");
      if (r.family === 6 && isBlockedIPv6(r.address)) throw new Error("Host resuelve a IP privada");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Host")) throw err;
    throw new Error("No se pudo resolver el host");
  }
  return url;
}

/**
 * Realiza un fetch siguiendo redirects manualmente, revalidando que cada
 * salto siga apuntando a una URL pública. Máximo 3 redirects.
 */
export async function safePublicFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  let current = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current.toString(), { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      const next = new URL(loc, current);
      current = await assertPublicUrl(next.toString());
      continue;
    }
    return res;
  }
  throw new Error("Demasiados redirects");
}
