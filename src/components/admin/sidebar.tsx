"use client";

import { cn } from "@/lib/utils";
import {
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  Component,
  FileText,
  FlaskConical,
  ImageIcon,
  Key,
  Layers,
  LayoutDashboard,
  ListTree,
  Mailbox,
  MessageSquare,
  Newspaper,
  Palette,
  PenTool,
  Search,
  Settings,
  Sparkles,
  Tag,
  Users,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; soon?: boolean }>;
}> = [
  {
    label: "General",
    items: [
      { href: "/admin", label: "Inicio", icon: LayoutDashboard },
      { href: "/admin/contenido", label: "Contenido", icon: PenTool },
      { href: "/admin/medios", label: "Medios", icon: ImageIcon },
      { href: "/admin/colecciones", label: "Colecciones", icon: Layers },
      { href: "/admin/paginas", label: "Páginas", icon: FileText },
      { href: "/admin/simbolos", label: "Símbolos", icon: Component },
      { href: "/admin/temas", label: "Temas", icon: Palette },
      { href: "/admin/buscar", label: "Buscar", icon: Search },
      { href: "/admin/ask", label: "Ask CSM", icon: Sparkles },
      { href: "/admin/comentarios", label: "Comentarios", icon: MessageSquare },
    ],
  },
  {
    label: "Crecer",
    items: [
      { href: "/admin/forms", label: "Formularios", icon: ClipboardList },
      { href: "/admin/automatizaciones", label: "Automatización", icon: Zap },
      { href: "/admin/calendario", label: "Calendario", icon: Calendar, soon: true },
      { href: "/admin/suscriptores", label: "Suscriptores", icon: Mailbox, soon: true },
      { href: "/admin/campanas", label: "Campañas", icon: Newspaper, soon: true },
      { href: "/admin/ab-tests", label: "A/B Tests", icon: FlaskConical, soon: true },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/api-keys", label: "API keys", icon: Key },
      { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/admin/menus", label: "Menús", icon: ListTree },
      { href: "/admin/redirects", label: "Redirecciones", icon: ArrowRightLeft },
      { href: "/admin/api-docs", label: "Docs API", icon: BookOpen },
      { href: "/admin/analiticas", label: "Analíticas", icon: BarChart3, soon: true },
      { href: "/admin/equipo", label: "Equipo", icon: Users, soon: true },
      { href: "/admin/etiquetas", label: "Taxonomías", icon: Tag, soon: true },
      { href: "/admin/workflows", label: "Workflows", icon: Workflow, soon: true },
      { href: "/admin/ajustes", label: "Ajustes", icon: Settings, soon: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card/30 backdrop-blur md:flex md:flex-col">
      <nav className="flex-1 space-y-6 overflow-y-auto p-4 text-sm">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-foreground/80 transition-colors",
                        active
                          ? "bg-primary/12 text-foreground"
                          : "hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.soon ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          pronto
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
