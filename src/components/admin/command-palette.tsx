"use client";

import { createNewPostAction } from "@/app/admin/contenido/_actions";
import { authClient } from "@/auth/client";
import { setWorkspaceCookie } from "@/components/admin/_actions";
import type { WorkspaceOption } from "@/components/admin/workspace-switcher";
import { Command } from "cmdk";
import {
  ArrowRightLeft,
  BarChart3,
  Calendar,
  Check,
  FileText,
  FlaskConical,
  ImageIcon,
  Key,
  Layers,
  LayoutDashboard,
  LogOut,
  Mailbox,
  Monitor,
  Moon,
  Newspaper,
  PenTool,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const CommandPaletteCtx = createContext<Ctx | null>(null);

export function useCommandPalette() {
  const v = useContext(CommandPaletteCtx);
  if (!v) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return v;
}

type Props = {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  children: ReactNode;
};

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  hint?: string;
  soon?: boolean;
}> = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, hint: "Dashboard" },
  { href: "/admin/contenido", label: "Contenido", icon: PenTool, hint: "Posts y borradores" },
  { href: "/admin/medios", label: "Medios", icon: ImageIcon, soon: true },
  { href: "/admin/colecciones", label: "Colecciones", icon: Layers, soon: true },
  { href: "/admin/paginas", label: "Páginas", icon: FileText, soon: true },
  { href: "/admin/calendario", label: "Calendario", icon: Calendar, soon: true },
  { href: "/admin/suscriptores", label: "Suscriptores", icon: Mailbox, soon: true },
  { href: "/admin/campanas", label: "Campañas", icon: Newspaper, soon: true },
  { href: "/admin/ab-tests", label: "A/B Tests", icon: FlaskConical, soon: true },
  { href: "/admin/automatizaciones", label: "Automatización", icon: Zap, soon: true },
  { href: "/admin/analiticas", label: "Analíticas", icon: BarChart3, soon: true },
  { href: "/admin/equipo", label: "Equipo", icon: Users, soon: true },
  { href: "/admin/etiquetas", label: "Taxonomías", icon: Tag, soon: true },
  { href: "/admin/workflows", label: "Workflows", icon: Workflow, soon: true },
  { href: "/admin/api", label: "API", icon: Key, soon: true },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings, soon: true },
];

export function CommandPaletteProvider({ current, workspaces, children }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const ctxValue = useMemo<Ctx>(() => ({ open, setOpen, toggle }), [open, toggle]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function pickTheme(t: "light" | "dark" | "system") {
    setTheme(t);
    setOpen(false);
  }

  function pickWorkspace(slug: string) {
    if (slug === current.slug) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setWorkspaceCookie(slug);
      setOpen(false);
      router.refresh();
    });
  }

  function createPost() {
    setOpen(false);
    startTransition(async () => {
      const res = await createNewPostAction();
      if (res.ok) {
        router.push(`/admin/contenido/${res.id}`);
      } else {
        console.error("createPost failed", res.error);
      }
    });
  }

  async function signOut() {
    setOpen(false);
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <CommandPaletteCtx.Provider value={ctxValue}>
      {children}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Paleta de comandos"
        className="fixed inset-0 z-[200] grid place-items-start justify-items-center overflow-y-auto bg-background/60 px-4 pt-[12vh] pb-8 backdrop-blur-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-popover/95 shadow-2xl shadow-black/30 backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Busca acciones, secciones, workspaces…"
              className="h-12 w-full bg-transparent pl-11 pr-16 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              esc
            </kbd>
          </div>
          <div className="h-px bg-border" />
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 size-5 opacity-60" />
              Sin resultados. Prueba con otro término.
            </Command.Empty>

            <Command.Group
              heading="Acciones"
              className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5"
            >
              <Item
                onSelect={createPost}
                icon={<Plus className="size-4" />}
                label="Crear nueva entrada"
                hint="POST en blanco"
                disabled={pending}
                shortcut="↵"
              />
            </Command.Group>

            <Command.Separator className="my-1 h-px bg-border/60" />

            <Command.Group
              heading="Ir a"
              className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5"
            >
              {NAV_ITEMS.map((it) => (
                <Item
                  key={it.href}
                  onSelect={() => go(it.href)}
                  icon={<it.icon className="size-4" />}
                  label={it.label}
                  hint={it.hint}
                  badge={it.soon ? "pronto" : null}
                />
              ))}
            </Command.Group>

            {workspaces.length > 1 ? (
              <>
                <Command.Separator className="my-1 h-px bg-border/60" />
                <Command.Group
                  heading="Workspaces"
                  className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5"
                >
                  {workspaces.map((w) => (
                    <Item
                      key={w.id}
                      onSelect={() => pickWorkspace(w.slug)}
                      icon={
                        <span className="grid size-5 place-items-center rounded-md bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-[10px] font-bold text-white">
                          {w.name.charAt(0)}
                        </span>
                      }
                      label={w.name}
                      hint={w.role}
                      trailing={
                        w.slug === current.slug ? <Check className="size-3.5 text-primary" /> : null
                      }
                    />
                  ))}
                </Command.Group>
              </>
            ) : null}

            <Command.Separator className="my-1 h-px bg-border/60" />

            <Command.Group
              heading="Apariencia"
              className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5"
            >
              <Item
                onSelect={() => pickTheme("light")}
                icon={<Sun className="size-4" />}
                label="Tema claro"
                trailing={theme === "light" ? <Check className="size-3.5 text-primary" /> : null}
              />
              <Item
                onSelect={() => pickTheme("dark")}
                icon={<Moon className="size-4" />}
                label="Tema oscuro"
                trailing={theme === "dark" ? <Check className="size-3.5 text-primary" /> : null}
              />
              <Item
                onSelect={() => pickTheme("system")}
                icon={<Monitor className="size-4" />}
                label="Tema del sistema"
                trailing={theme === "system" ? <Check className="size-3.5 text-primary" /> : null}
              />
            </Command.Group>

            <Command.Separator className="my-1 h-px bg-border/60" />

            <Command.Group
              heading="Sesión"
              className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5"
            >
              <Item onSelect={signOut} icon={<LogOut className="size-4" />} label="Cerrar sesión" />
              <Item
                onSelect={() => go("/")}
                icon={<ArrowRightLeft className="size-4" />}
                label="Ir a la landing"
              />
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↓</kbd>
              <span>navegar</span>
              <span className="mx-1">·</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↵</kbd>
              <span>seleccionar</span>
            </div>
            <span className="hidden sm:inline">CSM ⌘K</span>
          </div>
        </div>
      </Command.Dialog>
    </CommandPaletteCtx.Provider>
  );
}

function Item({
  onSelect,
  icon,
  label,
  hint,
  badge,
  trailing,
  disabled,
  shortcut,
}: {
  onSelect: () => void;
  icon: ReactNode;
  label: string;
  hint?: string;
  badge?: string | null;
  trailing?: ReactNode;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <Command.Item
      value={`${label} ${hint ?? ""}`}
      onSelect={onSelect}
      disabled={disabled}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-foreground/90 outline-none aria-selected:bg-primary/12 aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
    >
      <span className="grid size-7 place-items-center rounded-lg bg-muted/60 text-muted-foreground group-aria-selected:bg-primary/15 group-aria-selected:text-primary">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint ? <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span> : null}
      {badge ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {badge}
        </span>
      ) : null}
      {trailing}
      {shortcut ? (
        <kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          {shortcut}
        </kbd>
      ) : null}
    </Command.Item>
  );
}

export function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex flex-1 items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur transition-colors hover:bg-muted/40 md:max-w-md"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Buscar acciones, secciones…</span>
      <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
    </button>
  );
}
