import { cn } from "@/lib/utils";
import { requireWorkspace } from "@/lib/workspace";
import {
  Bell,
  KeyRound,
  Lock,
  type LucideIcon,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from "lucide-react";
import Link from "next/link";

type NavItem = { href: string; label: string; icon: LucideIcon; description: string };

const NAV: NavItem[] = [
  {
    href: "/admin/ajustes/perfil",
    label: "Perfil",
    icon: UserCircle,
    description: "Tu nombre, avatar y preferencias",
  },
  {
    href: "/admin/ajustes/seguridad",
    label: "Seguridad",
    icon: ShieldCheck,
    description: "2FA, passkeys, sesiones",
  },
  {
    href: "/admin/ajustes/privacidad",
    label: "Privacidad",
    icon: Lock,
    description: "Exportar datos, eliminar cuenta, cookies",
  },
  {
    href: "/admin/ajustes/notificaciones",
    label: "Notificaciones",
    icon: Bell,
    description: "Email, push y mentions",
  },
  {
    href: "/admin/ajustes/ia",
    label: "Inteligencia Artificial",
    icon: Sparkles,
    description: "Proveedores, modelo local, presupuesto y uso",
  },
  {
    href: "/admin/ajustes/api",
    label: "API",
    icon: KeyRound,
    description: "Keys, webhooks y MCP",
  },
];

export default async function AjustesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspace("editor");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 md:flex-row md:gap-10">
      <aside className="md:w-60 md:shrink-0">
        <div className="sticky top-4 space-y-1">
          <h2 className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Ajustes
          </h2>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    "hover:bg-muted/50 [&.active]:bg-primary/12 [&.active]:text-foreground",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  <span className="flex-1 leading-tight">
                    <span className="block font-medium">{item.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1 space-y-8">{children}</div>
    </div>
  );
}
