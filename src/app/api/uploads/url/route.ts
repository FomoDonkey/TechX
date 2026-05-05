import { getCurrentUser } from "@/auth/server";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, ingestUpload } from "@/lib/media";
import { httpUrlSchema } from "@/lib/safe-url";
import { safePublicFetch } from "@/lib/ssrf";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  url: httpUrlSchema(),
  folderId: z.string().nullable().optional(),
  filename: z.string().optional(),
});

function safeFilenameFromUrl(u: string, fallback: string): string {
  try {
    const url = new URL(u);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last && last.length > 0 ? decodeURIComponent(last).slice(0, 120) : fallback;
  } catch {
    return fallback;
  }
}

export async function POST(req: Request) {
  const ctx = await requireWorkspace("author");
  const user = await getCurrentUser();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "JSON inválido";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const folderId = body.folderId && isUuid(body.folderId) ? body.folderId : null;

  let res: Response;
  try {
    res = await safePublicFetch(body.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo descargar la URL";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `Origen devolvió ${res.status}` }, { status: 400 });
  }

  const mime = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `Tipo no permitido: ${mime || "desconocido"}` },
      { status: 400 },
    );
  }

  const lengthHdr = res.headers.get("content-length");
  if (lengthHdr && Number(lengthHdr) > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Demasiado grande (máx 50MB)" }, { status: 400 });
  }

  const arr = await res.arrayBuffer();
  if (arr.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Demasiado grande (máx 50MB)" }, { status: 400 });
  }

  const filename = body.filename ?? safeFilenameFromUrl(body.url, "descarga.bin");
  try {
    const row = await ingestUpload({
      workspaceId: ctx.workspace.id,
      uploadedById: user?.id ?? null,
      folderId,
      filename,
      mime,
      buffer: Buffer.from(arr),
    });
    return NextResponse.json({ ok: true, id: row.id, filename });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
