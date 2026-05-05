import { deletePasskey, renamePasskey } from "@/auth/passkeys";
import { getCurrentUser } from "@/auth/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deletePasskey({ userId: user.id, passkeyId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server_error" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  try {
    await renamePasskey({ userId: user.id, passkeyId: id, name: body.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server_error" },
      { status: 400 },
    );
  }
}
