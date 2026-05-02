import { createRoute } from "@/api/runtime";
import { MeResponseSchema } from "@/api/schemas";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const GET = createRoute({
  method: "GET",
  path: "/api/v1/me",
  tag: "Auth",
  summary: "Información de la API key autenticada",
  scopes: [],
  response: MeResponseSchema,
  handler: async ({ ctx }) => {
    if (!db) throw new Error("DB no configurada");
    const [ws] = await db
      .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspaceId))
      .limit(1);
    return {
      apiKey: {
        id: ctx.apiKey.id,
        workspaceId: ctx.apiKey.workspaceId,
        environment: ctx.apiKey.environment,
        scopes: ctx.apiKey.scopes,
        rateLimit: ctx.apiKey.rateLimit,
      },
      workspace: ws ?? { id: ctx.workspaceId, name: "Workspace", slug: "default" },
    };
  },
});
