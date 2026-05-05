import { verifyPasskeyRegistration } from "@/auth/passkeys";
import { getCurrentUser } from "@/auth/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { response: unknown; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const result = await verifyPasskeyRegistration({
      userId: user.id,
      response: body.response,
      name: body.name,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server_error" },
      { status: 400 },
    );
  }
}
