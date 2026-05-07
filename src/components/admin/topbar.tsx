import { type BranchOption, BranchSwitcher } from "@/components/admin/branch-switcher";
import { CommandPaletteTrigger } from "@/components/admin/command-palette";
import { NotificationBell } from "@/components/admin/notification-bell";
import { LogoLockup } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { UserMenu } from "./user-menu";
import { type WorkspaceOption, WorkspaceSwitcher } from "./workspace-switcher";

export function Topbar({
  user,
  current,
  workspaces,
  activeBranch,
  branches,
}: {
  user: { name: string; email: string; image?: string | null };
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  activeBranch: BranchOption;
  branches: BranchOption[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/40 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center transition-transform hover:scale-[1.02]"
        >
          <LogoLockup size="sm" className="hidden sm:inline-flex" />
          <LogoLockup size="sm" showWordmark={false} className="sm:hidden" />
        </Link>
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <WorkspaceSwitcher current={current} workspaces={workspaces} />
        <BranchSwitcher active={activeBranch} options={branches} />
      </div>

      <div className="hidden flex-1 md:flex md:max-w-md">
        <CommandPaletteTrigger />
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
