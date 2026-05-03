import { requireWorkspace } from "@/lib/workspace";
import { getSegment } from "@/newsletter/segments-lib";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SegmentEditor } from "../_editor";

export const metadata: Metadata = { title: "Editar segmento · CSM" };
export const dynamic = "force-dynamic";

export default async function EditSegmentPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await requireWorkspace("editor");
  const segment = await getSegment(ctx.workspace.id, id);
  if (!segment) notFound();
  return <SegmentEditor segment={segment} />;
}
