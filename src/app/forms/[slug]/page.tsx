import { getPublishedFormBySlug } from "@/forms/lib";
import type { FormSchema, FormSettings } from "@/forms/types";
import { resolveWorkspaceIdByHost } from "@/redirects/runtime";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicFormClient } from "./client";

export const dynamic = "force-dynamic";

async function resolveFormForRequest(slug: string) {
  const h = await headers();
  const host = h.get("host") ?? "";
  const workspaceId = await resolveWorkspaceIdByHost(host);
  return workspaceId ? getPublishedFormBySlug(workspaceId, slug) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const form = await resolveFormForRequest(slug);
  if (!form) return { title: "Form no encontrado" };
  return {
    title: `${form.name} · techx`,
    description: form.description ?? undefined,
  };
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await resolveFormForRequest(slug);
  if (!form) notFound();
  const schema = (form.schema ?? { fields: [], steps: [] }) as FormSchema;
  const settings = (form.settings ?? {}) as FormSettings;
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80 py-12 px-4">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-semibold">{form.name}</h1>
          {form.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{form.description}</p>
          ) : null}
        </div>
        <PublicFormClient
          slug={form.slug}
          schema={schema}
          publicSettings={{
            honeypotFieldName: settings.honeypotFieldName ?? "csm_company",
            minSubmitTimeMs: settings.minSubmitTimeMs ?? 1500,
            captcha: settings.captcha,
            doubleOptIn: Boolean(settings.doubleOptIn),
          }}
          successMessage={form.successMessage}
          redirectUrl={form.redirectUrl}
        />
        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Powered by{" "}
          <a href="/" className="hover:underline">
            CSM
          </a>
        </p>
      </div>
    </main>
  );
}
