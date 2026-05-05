import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { insertReturning } from "@/db/dialect";
import { imports } from "@/db/schema";
import { detectSource, getParser } from "@/imports/registry";
import type { ImportSource } from "@/imports/types";
import { logActivity } from "@/lib/activity";
import { requireWorkspace } from "@/lib/workspace";
import { buildAssetKey, currentStorage } from "@/storage";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMPORT_BYTES = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIMES = new Set<string>([
  "application/xml",
  "text/xml",
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "text/markdown",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/atom+xml",
  "application/rss+xml",
]);

const VALID_SOURCES: readonly ImportSource[] = [
  "wordpress",
  "notion",
  "markdown",
  "ghost",
  "rss",
  "csv",
];

/** GET /api/admin/imports — lista de imports del workspace, recientes primero. */
export async function GET() {
  const ctx = await requireWorkspace("editor");
  if (!db) return NextResponse.json({ rows: [] });
  const rows = await db
    .select()
    .from(imports)
    .where(eq(imports.workspaceId, ctx.workspace.id))
    .orderBy(desc(imports.createdAt))
    .limit(50);
  return NextResponse.json({ rows });
}

/** POST /api/admin/imports — sube archivo + crea fila imports en estado uploaded. */
export async function POST(req: Request) {
  const ctx = await requireWorkspace("editor");
  const user = await getCurrentUser();
  if (!db) return NextResponse.json({ error: "DB no configurada" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Multipart inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "Archivo demasiado grande (máx 100MB)" }, { status: 400 });
  }

  const declaredMime = file.type || "application/octet-stream";
  // Aceptamos octet-stream (subidas zip de browsers viejos) sólo si la
  // extensión está en la whitelist. Bloquea binarios arbitrarios.
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const ALLOWED_EXT = new Set([
    "xml",
    "wxr",
    "zip",
    "json",
    "md",
    "mdx",
    "markdown",
    "rss",
    "atom",
    "csv",
    "tsv",
  ]);
  if (declaredMime === "application/octet-stream" && !ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Extensión no permitida: .${ext}` }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(declaredMime) && declaredMime !== "application/octet-stream") {
    return NextResponse.json({ error: `Tipo no permitido: ${declaredMime}` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Detect source (preferencia: parámetro explícito, fallback auto-detect)
  const requestedSource = form.get("source");
  let source: ImportSource | null = null;
  if (
    typeof requestedSource === "string" &&
    VALID_SOURCES.includes(requestedSource as ImportSource)
  ) {
    source = requestedSource as ImportSource;
  } else {
    source = await detectSource({
      name: file.name,
      mime: declaredMime,
      head: buf.subarray(0, 4096),
    });
  }
  if (!source) {
    return NextResponse.json(
      { error: "No se pudo detectar el formato. Selecciona uno manualmente." },
      { status: 400 },
    );
  }

  // Subir a storage con prefijo /imports/
  const fileKey = buildAssetKey(
    ctx.workspace.id,
    file.name.split(".").pop() ?? "bin",
    `imp_${nanoid(12)}`,
  );
  const storage = currentStorage();
  await storage.put(fileKey, buf, { contentType: declaredMime });

  // Describe rápido para preview
  let describe: Awaited<ReturnType<ReturnType<typeof getParser>["describe"]>> | null = null;
  try {
    const parser = getParser(source);
    describe = await parser.describe(buf);
  } catch (err) {
    // describe puede fallar si el archivo está corrupto — guardamos igualmente
    // y el usuario verá el error en el wizard
    describe = null;
  }

  const newId = crypto.randomUUID();
  const created = (await insertReturning(imports, {
    id: newId,
    workspaceId: ctx.workspace.id,
    source,
    status: "uploaded",
    fileKey,
    fileName: file.name.slice(0, 200),
    fileSize: file.size,
    mediaPolicy: "link",
    mapping: null,
    stats: {
      detected: describe?.totalItems ?? 0,
      planned: describe?.totalItems ?? 0,
      imported: 0,
      skipped: 0,
      errored: 0,
      mediaPlanned: 0,
      mediaImported: 0,
    },
    createdById: user?.id ?? null,
  })) as typeof imports.$inferSelect;

  if (!created) {
    return NextResponse.json({ error: "No se pudo crear el import" }, { status: 500 });
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorId: user?.id ?? null,
    action: "import.created",
    targetType: "import",
    targetId: created.id,
    meta: { source, fileName: file.name, fileSize: file.size },
  });

  return NextResponse.json({ id: created.id, source, describe });
}
