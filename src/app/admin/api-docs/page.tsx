import { listRegisteredRoutes } from "@/api/openapi";
import { env } from "@/env";
import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { ApiDocsClient } from "./client";

// Forzar el registro: el OpenAPI registry es global y se llena al importar
// los routes. Esto garantiza que el listado esté completo al renderizar.
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

export const metadata: Metadata = { title: "Docs API · techx" };
export const dynamic = "force-dynamic";

export default async function ApiDocsPage() {
  await requireWorkspace("author");
  const routes = listRegisteredRoutes();
  return <ApiDocsClient routes={routes} serverUrl={env.NEXT_PUBLIC_APP_URL} />;
}
