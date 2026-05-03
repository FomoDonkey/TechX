import { requireWorkspace } from "@/lib/workspace";
import { getCampaign, getCampaignStats } from "@/newsletter/campaigns-lib";
import { listSegments } from "@/newsletter/segments-lib";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignEditor } from "./editor";

export const metadata: Metadata = { title: "Editar campaña · CSM" };
export const dynamic = "force-dynamic";

export default async function CampaignEditPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await requireWorkspace("editor");
  const [campaign, segs, stats] = await Promise.all([
    getCampaign(ctx.workspace.id, id),
    listSegments(ctx.workspace.id),
    getCampaignStats(id),
  ]);
  if (!campaign) notFound();
  return <CampaignEditor campaign={campaign} segments={segs} stats={stats} />;
}
