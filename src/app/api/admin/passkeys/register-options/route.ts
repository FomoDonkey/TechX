import { generatePasskeyRegistrationOptions } from "@/auth/passkeys";
import { getCurrentUser } from "@/auth/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const opts = await generatePasskeyRegistrationOptions({
      id: user.id,
      email: user.email,
      name: user.name ?? user.email,
    });
    return NextResponse.json(opts);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server_error" },
      { status: 500 },
    );
  }
}
