import { getFormById } from "@/forms/lib";
import type { FormSettings } from "@/forms/types";
import { requireWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { SettingsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function FormSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("editor");
  const form = await getFormById(ctx.workspace.id, id);
  if (!form) notFound();
  return (
    <SettingsClient
      formId={id}
      initial={{
        name: form.name,
        slug: form.slug,
        description: form.description ?? "",
        notificationEmails: form.notificationEmails ?? [],
        successMessage: form.successMessage ?? "",
        redirectUrl: form.redirectUrl ?? "",
        settings: (form.settings ?? {}) as FormSettings,
      }}
    />
  );
}
