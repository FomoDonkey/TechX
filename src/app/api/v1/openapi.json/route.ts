import { buildOpenApiDocument } from "@/api/openapi";
import { env } from "@/env";

// Importamos los handlers para forzar el registro en el OpenAPI registry
// (Next.js carga las rutas perezosamente, así que sin este import el endpoint
//  /openapi.json se generaría con un registry vacío en cold-start.)
import "@/app/api/v1/entries/route";
import "@/app/api/v1/entries/[id]/route";
import "@/app/api/v1/entries/[id]/publish/route";
import "@/app/api/v1/collections/route";
import "@/app/api/v1/collections/[slug]/route";
import "@/app/api/v1/media/route";
import "@/app/api/v1/media/[id]/route";
import "@/app/api/v1/pages/route";
import "@/app/api/v1/pages/[id]/route";
import "@/app/api/v1/comments/route";
import "@/app/api/v1/comments/[id]/route";
import "@/app/api/v1/taxonomies/route";
import "@/app/api/v1/me/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const doc = buildOpenApiDocument({
    title: "CSM API",
    version: "1.0.0",
    description:
      "API REST de CSM. Auth con API key (Bearer o X-API-Key). Cada workspace tiene sus propias keys con scopes finos. Filtros: ?where[field][op]=value. Sort: ?sort=-publishedAt,title. Pagination cursor: ?cursor=. Idempotency: header Idempotency-Key.",
    serverUrl: env.NEXT_PUBLIC_APP_URL,
  });
  return new Response(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60",
    },
  });
}
