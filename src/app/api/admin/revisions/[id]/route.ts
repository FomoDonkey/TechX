import { requireUser } from "@/auth/server";
import { db } from "@/db/client";
import { entries, revisions } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import { requireWorkspace } from "@/lib/workspace";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function bodyToText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) for (const c of n.content) visit(c);
  };
  visit(body);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const ctx = await requireWorkspace("viewer");
  if (!db) return NextResponse.json({ ok: false, error: "DB no configurada" }, { status: 503 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  const [row] = await db
    .select({
      revision: revisions,
      workspaceId: entries.workspaceId,
    })
    .from(revisions)
    .innerJoin(entries, eq(entries.id, revisions.entryId))
    .where(and(eq(revisions.id, id), eq(entries.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return NextResponse.json({ ok: false, error: "No encontrada" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    bodyText: bodyToText(row.revision.body),
    body: row.revision.body,
    createdAt: row.revision.createdAt,
  });
}
