import { requireWorkspace } from "@/lib/workspace";
import type { Metadata } from "next";
import { SegmentEditor } from "../_editor";

export const metadata: Metadata = { title: "Nuevo segmento · CSM" };
export const dynamic = "force-dynamic";

export default async function NewSegmentPage() {
  await requireWorkspace("editor");
  return <SegmentEditor />;
}
