import { getCurrentUser } from "@/auth/server";
import { features } from "@/env";
import { listUserWorkspaces } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./_wizard";

export const metadata = { title: "Onboarding mágico" };

export default async function OnboardingPage() {
  if (!features.database) {
    return (
      <main className="grid min-h-screen place-items-center p-8 text-center">
        <div className="max-w-lg space-y-3">
          <h1 className="font-display text-2xl font-semibold">Onboarding desactivado</h1>
          <p className="text-muted-foreground">
            Conecta una base de datos en{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">.env</code> y vuelve. El AI Site
            Generator necesita persistir tu workspace.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  // Si ya tiene workspace(s), no re-onboardar — directo al admin.
  // (Para crear workspace adicional, Fase 2+ tendrá una ruta dedicada.)
  const wsList = await listUserWorkspaces(user.id);
  if (wsList.length > 0) redirect("/admin");

  return <OnboardingWizard userName={user.name ?? "tú"} />;
}
