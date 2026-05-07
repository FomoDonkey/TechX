import { generateImageAction } from "@/app/admin/medios/_ai-actions";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Auth gate explícito en el route handler. Aunque la server action interna
  // llama `requireWorkspace`, el endpoint público no debe ser accesible sin
  // sesión: protege contra DoS-económico (gastar créditos AI desde anon).
  try {
    await requireWorkspace("editor");
  } catch {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  try {
    const parsed = body as { prompt: string; ratio?: "1:1" | "16:9" | "9:16" | "4:3" };
    const res = await generateImageAction({ prompt: parsed.prompt, ratio: parsed.ratio ?? "1:1" });
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
