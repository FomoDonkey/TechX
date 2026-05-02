import { getAutomationById } from "@/automations/lib";
import type { ConditionGroup, Step, Trigger, TriggerType } from "@/automations/types";
import { requireWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { AutomationClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace("editor");
  const auto = await getAutomationById(ctx.workspace.id, id);
  if (!auto) notFound();

  return (
    <AutomationClient
      automation={{
        id: auto.id,
        name: auto.name,
        slug: auto.slug,
        description: auto.description ?? "",
        triggerType: auto.triggerType as TriggerType,
        trigger: auto.trigger as Trigger,
        conditions: (auto.conditions ?? null) as ConditionGroup | null,
        steps: (auto.actions as unknown as Step[]) ?? [],
        active: auto.active,
        webhookSecret: auto.webhookSecret,
        runsTotal: auto.runsTotal,
        runsFailed: auto.runsFailed,
      }}
    />
  );
}
