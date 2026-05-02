import { db } from "@/db/client";
import { entries, users, workspaces } from "@/db/schema";
import { renderOg } from "@/lib/og";
import { isUuid } from "@/lib/uuid";
import { resolveActiveTheme } from "@/themes/active";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const revalidate = 3600;

const FALLBACK_TEMPLATE = {
  background: { kind: "gradient" as const, from: "#0c0a14", to: "#1a1228", angle: 135 },
  accent: "#c08bff",
  font: { display: "ui-sans-serif", body: "ui-sans-serif" },
  showLogo: true,
  showAuthor: true,
  showDate: true,
  layout: "left" as const,
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id) || !db) {
    return renderOg({
      template: FALLBACK_TEMPLATE,
      title: "Sin título",
      eyebrow: "Artículo",
      workspaceName: "CSM",
    });
  }
  try {
    const [row] = await db
      .select({
        title: entries.title,
        publishedAt: entries.publishedAt,
        authorName: users.name,
        workspaceId: entries.workspaceId,
        workspaceName: workspaces.name,
      })
      .from(entries)
      .leftJoin(users, eq(users.id, entries.authorId))
      .leftJoin(workspaces, eq(workspaces.id, entries.workspaceId))
      // Solo entries publicados — los drafts no deben filtrar título via OG.
      .where(and(eq(entries.id, id), eq(entries.status, "published")))
      .limit(1);
    if (!row) {
      return renderOg({
        template: FALLBACK_TEMPLATE,
        title: "Artículo no encontrado",
        workspaceName: "CSM",
      });
    }
    const { spec } = await resolveActiveTheme(row.workspaceId);
    const date = row.publishedAt
      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(row.publishedAt)
      : null;
    return renderOg({
      template: spec.ogTemplate,
      title: row.title,
      eyebrow: "Artículo",
      authorName: row.authorName,
      date,
      workspaceName: row.workspaceName ?? "CSM",
    });
  } catch {
    return renderOg({
      template: FALLBACK_TEMPLATE,
      title: "Artículo",
      workspaceName: "CSM",
    });
  }
}
