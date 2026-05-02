import { getCurrentUser } from "@/auth/server";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, ingestUpload } from "@/lib/media";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { emitAsync } from "@/webhooks/dispatcher";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await requireWorkspace("author");
  const user = await getCurrentUser();

  const url = new URL(req.url);
  const folderId = url.searchParams.get("folder");
  const targetFolder = folderId && isUuid(folderId) ? folderId : null;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Multipart inválido" }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Sin archivos" }, { status: 400 });
  }

  const results: Array<{ ok: boolean; id?: string; error?: string; filename: string }> = [];
  for (const file of files) {
    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("Demasiado grande (máx 50MB)");
      if (!ALLOWED_MIME.has(file.type)) throw new Error(`Tipo no permitido: ${file.type}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      const row = await ingestUpload({
        workspaceId: ctx.workspace.id,
        uploadedById: user?.id ?? null,
        folderId: targetFolder,
        filename: file.name,
        mime: file.type,
        buffer,
      });
      results.push({ ok: true, id: row.id, filename: file.name });
      emitAsync({
        workspaceId: ctx.workspace.id,
        event: "media.uploaded",
        payload: {
          id: row.id,
          url: row.url,
          filename: row.filename,
          mime: row.mime,
          size: row.size,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      results.push({ ok: false, filename: file.name, error: msg });
    }
  }

  return NextResponse.json({ results });
}
