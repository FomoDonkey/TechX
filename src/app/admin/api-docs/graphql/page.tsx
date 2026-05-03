import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { Playground } from "./playground";

export const metadata: Metadata = { title: "GraphQL · Docs API · CSM" };
export const dynamic = "force-dynamic";

export default async function GraphqlDocsPage() {
  await requireWorkspace("editor");
  return <Playground />;
}
