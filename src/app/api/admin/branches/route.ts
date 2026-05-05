import { listBranchesWithStats } from "@/branches";
import { requireWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireWorkspace("viewer");
  const rows = await listBranchesWithStats(ctx.workspace.id);
  return NextResponse.json({ rows });
}
