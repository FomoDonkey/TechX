/**
 * GraphQL endpoint: /api/graphql
 *
 * Maneja GET (no-op landing — el playground vive en /admin/api-docs/graphql)
 * y POST (queries). Auth via Bearer / X-API-Key igual que REST.
 */

import { yoga } from "@/graphql/yoga";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return yoga.handle(request, {});
}

export async function POST(request: Request) {
  return yoga.handle(request, {});
}

export async function OPTIONS(request: Request) {
  return yoga.handle(request, {});
}
