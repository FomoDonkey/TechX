/**
 * Anonimización de direcciones IP para almacenamiento.
 *
 * **Política GDPR (RGPD UE 2016/679 art. 5.1.c — minimización de datos)**:
 * Las IPs son datos personales. Para "device list" / forensics, almacenar
 * IP truncada (no la última identidad completa) cumple el principio de
 * minimización SIN perder utilidad razonable para el user (`/admin/ajustes/seguridad/sesiones`
 * sigue pudiendo decir "Madrid, ES" gracias al país, no a los 4 octetos).
 *
 * **Diseño**:
 * - IPv4: trunca el último octeto → `203.0.113.42` → `203.0.113.0`.
 * - IPv6: trunca a /48 (los primeros 3 hextets) → `2001:db8:abcd:1234::1` → `2001:db8:abcd::`.
 * - Inválido o vacío: devuelve `null`.
 *
 * Almacenar `203.0.113.0` permite identificar geolocalización aproximada y
 * detectar accesos desde redes radicalmente distintas (ASN/región), pero
 * imposibilita re-identificar al user concreto desde la IP almacenada
 * (al menos sin recurrir a logs externos del ISP).
 *
 * **Por qué mask y no hash**:
 * Hash con salt fijo permite linkability cross-row pero pierde geolocalización.
 * Mask conserva geolocalización aproximada y reduce identidad → mejor compromiso
 * para "session devices UI" (queremos mostrar "desde casa" / "fuera de casa").
 * Para audit forense (api_key_audit, comments) usamos `hashIp` con salt — la
 * linkability es la utilidad ahí.
 */

export function anonymizeIp(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const ip = raw.trim();
  if (!ip || ip === "unknown" || ip === "::1" || ip === "127.0.0.1") return null;

  // IPv4: a.b.c.d → a.b.c.0
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split(".");
    if (parts.length === 4 && parts.every((p) => Number(p) >= 0 && Number(p) <= 255)) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    return null;
  }

  // IPv4-mapped IPv6 → ::ffff:a.b.c.d
  if (/^::ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(ip)) {
    const v4 = ip.toLowerCase().slice(7);
    return anonymizeIp(v4);
  }

  // IPv6: trunca a /48 (3 hextets + ::)
  if (ip.includes(":")) {
    // Normaliza: separa por ':' y toma los primeros 3 hextets no vacíos.
    const hextets = ip.toLowerCase().split(":").filter(Boolean);
    if (hextets.length === 0) return null;
    const head = hextets.slice(0, 3);
    return `${head.join(":")}::`;
  }

  return null;
}

/**
 * Para UI: enmascara la IP de forma legible para el user
 * (`203.0.113.42` → `203.0.113.x`, `2001:db8:abcd:1234::1` → `2001:db8:abcd:…`).
 *
 * Diferente de `anonymizeIp` (storage): este es para mostrar al humano que
 * sepa "es la misma red que la última vez" sin revelar el host concreto.
 */
export function displayMaskIp(raw: string | null | undefined): string {
  if (!raw) return "—";
  const ip = raw.trim();
  if (!ip || ip === "unknown") return "—";

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }
  if (ip.includes(":")) {
    const hextets = ip.split(":").filter(Boolean);
    return `${hextets.slice(0, 3).join(":")}:…`;
  }
  return "—";
}
