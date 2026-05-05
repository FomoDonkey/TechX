import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { renderOg } from "@/lib/og";
import { resolveActiveTheme } from "@/themes/active";

export const runtime = "nodejs";
// Depende de la DB y del tema activo; no permitimos prerender estático
// (Satori no parsea `oklch(...)` en build sin polyfill, además el contenido
// es por-workspace).
export const dynamic = "force-dynamic";

const FALLBACK_TEMPLATE = {
  background: { kind: "gradient" as const, from: "#0c0a14", to: "#1a1228", angle: 135 },
  accent: "#c08bff",
  font: { display: "ui-sans-serif", body: "ui-sans-serif" },
  showLogo: true,
  showAuthor: false,
  showDate: false,
  layout: "centered" as const,
};

export async function GET() {
  if (!db) {
    return renderOg({
      template: FALLBACK_TEMPLATE,
      title: "CSM",
      eyebrow: "Content Spectacular Machine",
      workspaceName: "CSM",
    });
  }
  try {
    // TODO(custom-domains): resolver por host cuando aterrice multi-tenant routing.
    const [ws] = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1);
    if (!ws) {
      return renderOg({
        template: FALLBACK_TEMPLATE,
        title: "CSM",
        workspaceName: "CSM",
      });
    }
    const { spec } = await resolveActiveTheme(ws.id);
    return renderOg({
      template: spec.ogTemplate,
      title: ws.name,
      eyebrow: spec.tagline,
      workspaceName: ws.name,
    });
  } catch {
    return renderOg({
      template: FALLBACK_TEMPLATE,
      title: "CSM",
      workspaceName: "CSM",
    });
  }
}
