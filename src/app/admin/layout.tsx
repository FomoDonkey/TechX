import { getCurrentUser } from "@/auth/server";
import { CommandPaletteProvider } from "@/components/admin/command-palette";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";
import { UploadProvider } from "@/components/admin/uploader/upload-provider";
import { features } from "@/env";
import { currentWorkspace, listUserWorkspaces } from "@/lib/workspace";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!features.database) {
    return (
      <main className="grid min-h-screen place-items-center p-8 text-center">
        <div className="max-w-lg space-y-3">
          <h1 className="font-display text-2xl font-semibold">Admin desactivado</h1>
          <p className="text-muted-foreground">
            Conecta una base de datos en{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">.env</code> y ejecuta{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">npm run db:push</code> para activar el
            panel.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");

  const ctx = await currentWorkspace();
  if (!ctx) redirect("/onboarding");

  const wsList = await listUserWorkspaces(user.id);
  const options = wsList.map((m) => ({
    id: m.workspace.id,
    slug: m.workspace.slug,
    name: m.workspace.name,
    role: m.role as string,
  }));

  const currentOption = {
    id: ctx.workspace.id,
    slug: ctx.workspace.slug,
    name: ctx.workspace.name,
    role: ctx.role,
  };

  return (
    <CommandPaletteProvider current={currentOption} workspaces={options}>
      <UploadProvider>
        <div className="flex min-h-screen flex-col">
          <Topbar
            user={{
              name: user.name ?? "Sin nombre",
              email: user.email,
              image: user.image ?? null,
            }}
            current={currentOption}
            workspaces={options}
          />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </UploadProvider>
    </CommandPaletteProvider>
  );
}
