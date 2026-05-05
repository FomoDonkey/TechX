import { randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import { type EditorialCalendarToken, editorialCalendarTokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { type CalendarItem, listCalendarItems } from "./calendar";

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Devuelve el token de feed iCal del usuario en el workspace, creándolo si no
 * existe. La rotación es manual (`rotateCalendarToken`).
 */
export async function getOrCreateCalendarToken(
  workspaceId: string,
  userId: string,
  filters?: EditorialCalendarToken["filters"],
): Promise<EditorialCalendarToken> {
  if (!db) throw new Error("Database not available");
  const [existing] = await db
    .select()
    .from(editorialCalendarTokens)
    .where(
      and(
        eq(editorialCalendarTokens.workspaceId, workspaceId),
        eq(editorialCalendarTokens.userId, userId),
      ),
    )
    .limit(1);
  if (existing) return existing;
  const token = generateToken();
  const id = crypto.randomUUID();
  const created = (await insertReturning(editorialCalendarTokens, {
    id,
    workspaceId,
    userId,
    token,
    filters: filters ?? null,
  })) as EditorialCalendarToken;
  if (!created) throw new Error("No se pudo crear el token");
  return created;
}

export async function rotateCalendarToken(
  workspaceId: string,
  userId: string,
): Promise<EditorialCalendarToken> {
  if (!db) throw new Error("Database not available");
  const token = generateToken();
  await db
    .update(editorialCalendarTokens)
    .set({ token, rotatedAt: new Date() })
    .where(
      and(
        eq(editorialCalendarTokens.workspaceId, workspaceId),
        eq(editorialCalendarTokens.userId, userId),
      ),
    );
  const [updated] = await db
    .select()
    .from(editorialCalendarTokens)
    .where(
      and(
        eq(editorialCalendarTokens.workspaceId, workspaceId),
        eq(editorialCalendarTokens.userId, userId),
      ),
    )
    .limit(1);
  if (updated) return updated;
  return getOrCreateCalendarToken(workspaceId, userId);
}

export async function findTokenRecord(token: string): Promise<EditorialCalendarToken | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(editorialCalendarTokens)
    .where(eq(editorialCalendarTokens.token, token))
    .limit(1);
  return row ?? null;
}

/**
 * F9c.8a fix C2: cumple RFC 5545.
 *  - Strip control chars (excepto tab que es válido).
 *  - Escape backslash, semicolon, comma según RFC 5545 §3.3.11.
 *  - Normaliza CR/LF/CRLF → \n. CRs aislados sueltos serían parser-killers.
 */
function stripControlChars(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x09 || c === 0x0a || c === 0x0d) {
      out += s.charAt(i);
      continue;
    }
    if (c < 0x20 || c === 0x7f) continue;
    out += s.charAt(i);
  }
  return out;
}

function escapeIcal(s: string): string {
  return stripControlChars(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * RFC 5545 §3.1: las líneas largas DEBEN dividirse en chunks de máx 75 octetos
 * (UTF-8) usando un CRLF + SPACE (line folding). Sin esto los parsers estrictos
 * (Outlook, mailservers) rechazan el feed completo.
 */
function foldLine(line: string): string {
  // Operamos en bytes UTF-8 porque RFC habla de octetos.
  const bytes = Buffer.from(line, "utf-8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  // Avanzamos cuidadosamente para no cortar a mitad de un caracter UTF-8.
  while (i < bytes.length) {
    let end = Math.min(i + 75, bytes.length);
    // Retroceder si estamos a mitad de continuation byte (0b10xxxxxx).
    while (end < bytes.length && (bytes[end] ?? 0) >= 0x80 && (bytes[end] ?? 0) < 0xc0) {
      end--;
      if (end <= i) {
        end = Math.min(i + 75, bytes.length);
        break;
      }
    }
    chunks.push(bytes.subarray(i, end).toString("utf-8"));
    i = end;
  }
  // Continuation lines llevan un SPACE leading.
  return chunks.map((c, idx) => (idx === 0 ? c : ` ${c}`)).join("\r\n");
}

function formatIcalDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export type IcalRange = { from: Date; to: Date };

/**
 * Construye un VCALENDAR con los items del rango y los filtros del token.
 * El consumidor (Google Cal, Apple Cal, Outlook) refresca cada N min.
 */
export async function buildCalendarFeed(
  token: EditorialCalendarToken,
  range: IcalRange,
  baseUrl: string,
): Promise<string> {
  const items = await listCalendarItems({
    workspaceId: token.workspaceId,
    from: range.from,
    to: range.to,
    collectionIds: token.filters?.collectionIds,
    assigneeIds: token.filters?.onlyMine ? [token.userId] : undefined,
    includeDue: token.filters?.includeDue ?? true,
  });

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//CSM//Editorial Calendar//ES");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:CSM Editorial");
  lines.push("X-WR-TIMEZONE:UTC");

  const seen = new Set<string>();
  for (const it of items) {
    const uid = `${it.id}-${it.dateKind}@csm`;
    if (seen.has(uid)) continue;
    seen.add(uid);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
    lines.push(`DTSTART:${formatIcalDate(it.date)}`);
    // Eventos de 30 min como bloque visual.
    const end = new Date(it.date.getTime() + 30 * 60 * 1000);
    lines.push(`DTEND:${formatIcalDate(end)}`);
    const titlePrefix = it.dateKind === "due" ? "📅 SLA" : it.dateKind === "scheduled" ? "🗓️" : "✓";
    lines.push(`SUMMARY:${escapeIcal(`${titlePrefix} ${it.title}`)}`);
    lines.push(
      `DESCRIPTION:${escapeIcal(
        `Colección: ${it.collectionName}\\nEstado: ${it.status}\\nPrioridad: ${it.priority}`,
      )}`,
    );
    lines.push(`URL:${baseUrl}/admin/contenido/${it.id}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 §3.1: fold lines >75 octetos antes de joinear con CRLF.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export type _ItemForFeed = CalendarItem;
