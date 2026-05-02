import { db } from "@/db/client";
import { pages, workspaces } from "@/db/schema";
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
  showAuthor: false,
  showDate: false,
  layout: "centered" as const,
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id) || !db) {
    return renderOg({
      template: FALLBACK_TEMPLATE,
      title: "Sin título",
      workspaceName: "CSM",
    });
  }
  try {
    const [row] = await db
      .select({
        title: pages.title,
        workspaceId: pages.workspaceId,
        workspaceName: workspaces.name,
      })
      .from(pages)
      .leftJoin(workspaces, eq(workspaces.id, pages.workspaceId))
      // Solo pages publicadas — los drafts no deben filtrar título via OG.
      .where(and(eq(pages.id, id), eq(pages.status, "published")))
      .limit(1);
    if (!row) {
      return renderOg({
        template: FALLBACK_TEMPLATE,
        title: "Página",
        workspaceName: "CSM",
      });
    }
    const { spec } = await resolveActiveTheme(row.workspaceId);
    return renderOg({
      template: spec.ogTemplate,
      title: row.title,
      workspaceName: row.workspaceName ?? "CSM",
    });
  } catch {
    return renderOg({
      template: FALLBACK_TEMPLATE,
      title: "Página",
      workspaceName: "CSM",
    });
  }
}
