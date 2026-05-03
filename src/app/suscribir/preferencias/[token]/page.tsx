import { PublicNav } from "@/components/public/public-nav";
import { ThemeShell } from "@/components/public/theme-shell";
import { db } from "@/db/client";
import { subscribers } from "@/db/schema";
import { features } from "@/env";
import { getDefaultPublicWorkspace } from "@/lib/entries";
import { tokens } from "@/newsletter/tokens";
import { and, eq } from "drizzle-orm";
import { Settings2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { PreferencesForm } from "./_form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preferencias de suscripción",
  robots: { index: false, follow: false },
};

export default async function PreferencesPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const ws = features.database ? await getDefaultPublicWorkspace() : null;
  const verified = tokens.verifyPrefs(token);

  let sub: { email: string; name: string | null; tags: string[] | null } | null = null;
  if (verified && db) {
    const [row] = await db
      .select({ email: subscribers.email, name: subscribers.name, tags: subscribers.tags })
      .from(subscribers)
      .where(and(eq(subscribers.id, verified.sid), eq(subscribers.workspaceId, verified.ws)))
      .limit(1);
    sub = row ?? null;
  }

  return (
    <ThemeShell workspaceId={ws?.id}>
      <PublicNav workspace={ws} />
      <main className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <div className="rounded-[var(--th-radius-xl)] border border-[color:var(--th-border)] bg-[color:var(--th-bg-elevated)] p-8 md:p-12">
          {!sub ? (
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex size-14 items-center justify-center rounded-[var(--th-radius-pill)] bg-rose-500/15 text-rose-500">
                <XCircle className="size-7" />
              </span>
              <h1
                className="mt-4 text-2xl font-bold tracking-tight"
                style={{ fontFamily: "var(--th-font-display)" }}
              >
                Enlace no válido o caducado
              </h1>
              <p className="mt-3 text-[color:var(--th-fg-muted)]">
                Cada email contiene un enlace fresco a tus preferencias. Abre el último que
                recibiste.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <span className="inline-flex size-14 items-center justify-center rounded-[var(--th-radius-pill)] bg-[color:var(--th-brand)]/15 text-[color:var(--th-brand)]">
                  <Settings2 className="size-7" />
                </span>
                <h1
                  className="mt-4 text-2xl font-bold tracking-tight"
                  style={{ fontFamily: "var(--th-font-display)" }}
                >
                  Tus preferencias
                </h1>
                <p className="mt-2 text-[color:var(--th-fg-muted)]">
                  Suscrito como <strong>{sub.email}</strong>
                </p>
              </div>
              <PreferencesForm token={token} initialTags={sub.tags ?? []} />
            </>
          )}
        </div>
      </main>
    </ThemeShell>
  );
}
