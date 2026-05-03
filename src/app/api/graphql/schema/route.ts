/**
 * GET /api/graphql/schema
 *
 * Devuelve el schema GraphQL serializado como SDL en text/plain. Útil para
 * codegen client-side, intelligence en herramientas tipo Insomnia/Apollo
 * Studio, y para la CLI `csm types graphql`.
 */

import { csmGraphQLSchema } from "@/graphql/schema";
import { printSchema } from "graphql";

export const dynamic = "force-dynamic";

export async function GET() {
  const sdl = printSchema(csmGraphQLSchema);
  return new Response(sdl, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
