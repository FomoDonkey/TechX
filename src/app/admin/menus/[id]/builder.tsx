"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MenuItem, MenuItemType, MenuLocation } from "@/menus/types";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  GripVertical,
  Heading2,
  Layers,
  Link as LinkIcon,
  Minus,
  Plus,
  Save,
  Trash,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMenuAction, updateMenuAction } from "../actions";

interface Props {
  id: string;
  name: string;
  description: string;
  location: MenuLocation;
  isDefault: boolean;
  initialItems: MenuItem[];
  availablePages: Array<{ id: string; path: string; title: string }>;
  availableCollections: Array<{ slug: string; name: string }>;
}

const ITEM_TYPES: Array<{
  type: MenuItemType;
  label: string;
  icon: typeof LinkIcon;
  description: string;
}> = [
  { type: "link", label: "Enlace", icon: LinkIcon, description: "Path interno o URL" },
  { type: "page", label: "Página", icon: FileText, description: "Página publicada" },
  { type: "collection", label: "Colección", icon: Layers, description: "Listado de colección" },
  { type: "external", label: "Externo", icon: ExternalLink, description: "URL absoluta" },
  { type: "heading", label: "Encabezado", icon: Heading2, description: "Título de columna" },
  { type: "divider", label: "Separador", icon: Minus, description: "Línea divisoria" },
];

function newId() {
  return `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newItem(type: MenuItemType): MenuItem {
  const base = { id: newId(), label: type === "divider" ? "" : "Nuevo ítem" };
  switch (type) {
    case "link":
      return { ...base, type, href: "/" };
    case "external":
      return { ...base, type, href: "https://" };
    case "page":
      return { ...base, type, pageId: "" };
    case "collection":
      return { ...base, type, collectionSlug: "" };
    case "heading":
      return { ...base, type, children: [] };
    case "divider":
      return { ...base, type };
  }
}

// ============================================================
// Tree manipulation utilities
// ============================================================
type Path = number[];

function getAt(items: MenuItem[], path: Path): MenuItem | null {
  let list: MenuItem[] | undefined = items;
  let item: MenuItem | null = null;
  for (const idx of path) {
    if (!list || idx < 0 || idx >= list.length) return null;
    item = list[idx]!;
    list = "children" in item ? item.children : undefined;
  }
  return item;
}

function updateAt(items: MenuItem[], path: Path, mutate: (item: MenuItem) => MenuItem): MenuItem[] {
  if (path.length === 0) return items;
  const [head, ...rest] = path;
  return items.map((item, i) => {
    if (i !== head) return item;
    if (rest.length === 0) return mutate(item);
    if (!("children" in item) || !item.children) return item;
    return { ...item, children: updateAt(item.children, rest, mutate) };
  });
}

function removeAt(items: MenuItem[], path: Path): MenuItem[] {
  if (path.length === 0) return items;
  const [head, ...rest] = path;
  if (rest.length === 0) return items.filter((_, i) => i !== head);
  return items.map((item, i) => {
    if (i !== head) return item;
    if (!("children" in item) || !item.children) return item;
    return { ...item, children: removeAt(item.children, rest) };
  });
}

function insertChild(items: MenuItem[], path: Path, child: MenuItem): MenuItem[] {
  return updateAt(items, path, (item) => {
    if (!("children" in item)) return item;
    const children = [...(item.children ?? []), child];
    return { ...item, children };
  });
}

function moveAt(items: MenuItem[], path: Path, dir: -1 | 1): MenuItem[] {
  if (path.length === 0) return items;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1]!;
  const parentList =
    parentPath.length === 0
      ? items
      : ((getAt(items, parentPath) as { children?: MenuItem[] } | null)?.children ?? []);
  const target = idx + dir;
  if (target < 0 || target >= parentList.length) return items;
  const swap = (list: MenuItem[]) => {
    const next = [...list];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    return next;
  };
  if (parentPath.length === 0) return swap(items);
  return updateAt(items, parentPath, (parent) => {
    if (!("children" in parent) || !parent.children) return parent;
    return { ...parent, children: swap(parent.children) };
  });
}

function depthOf(path: Path): number {
  return path.length - 1;
}

function pathsEqual(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ============================================================
// Builder
// ============================================================
export function MenuBuilder(props: Props) {
  const router = useRouter();
  const [name, setName] = useState(props.name);
  const [description, setDescription] = useState(props.description);
  const [location, setLocation] = useState<MenuLocation>(props.location);
  const [isDefault, setIsDefault] = useState(props.isDefault);
  const [items, setItems] = useState<MenuItem[]>(props.initialItems);
  const [selectedPath, setSelectedPath] = useState<Path | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  // Ignora el primer ciclo de efectos para no marcar dirty al montar.
  const mountedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps son trigger-only para detectar dirty
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setDirty(true);
  }, [name, description, location, isDefault, items]);

  const selectedItem = selectedPath ? getAt(items, selectedPath) : null;

  function patchSelected(mut: (item: MenuItem) => MenuItem) {
    if (!selectedPath) return;
    setItems((prev) => updateAt(prev, selectedPath, mut));
  }

  function save() {
    start(async () => {
      try {
        await updateMenuAction({
          id: props.id,
          name,
          description,
          location,
          isDefault,
          items,
        });
        toast.success("Menú guardado");
        setDirty(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function destroy() {
    if (!confirm("¿Eliminar este menú? Acción irreversible.")) return;
    start(async () => {
      try {
        await deleteMenuAction(props.id);
        toast.success("Menú eliminado");
        router.push("/admin/menus");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className="rounded-2xl border bg-card/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Nombre</Label>
              <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-loc">Ubicación</Label>
              <select
                id="m-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value as MenuLocation)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="header">Cabecera</option>
                <option value="footer">Pie</option>
                <option value="sidebar">Lateral</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Descripción</Label>
            <Input
              id="m-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Menú por defecto</p>
              <p className="text-xs text-muted-foreground">
                Usado automáticamente en {LOCATION_NAME[location]} si no se especifica otro.
              </p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </section>

        <section className="rounded-2xl border bg-card/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Estructura</h2>
              <p className="text-xs text-muted-foreground">
                Hasta 3 niveles de profundidad. Arrastra el grip para reordenar dentro del mismo
                nivel.
              </p>
            </div>
            <AddRootButton
              onAdd={(t) => {
                setItems((prev) => [...prev, newItem(t)]);
                setSelectedPath([items.length]);
              }}
            />
          </div>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              Sin ítems. Añade el primero arriba.
            </div>
          ) : (
            <Tree
              items={items}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              onMove={(path, dir) => setItems((prev) => moveAt(prev, path, dir))}
              onAddChild={(path, type) =>
                setItems((prev) => insertChild(prev, path, newItem(type)))
              }
              onRemove={(path) => {
                setItems((prev) => removeAt(prev, path));
                if (selectedPath && pathsEqual(selectedPath, path)) setSelectedPath(null);
              }}
            />
          )}
        </section>
      </div>

      <aside className="space-y-3">
        <section className="rounded-2xl border bg-card/30 p-4 space-y-3 sticky top-4">
          {selectedItem && selectedPath ? (
            <Inspector
              item={selectedItem}
              path={selectedPath}
              availablePages={props.availablePages}
              availableCollections={props.availableCollections}
              onPatch={patchSelected}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Selecciona un ítem del árbol para editarlo.
            </div>
          )}
        </section>
        <div className="flex flex-col gap-2">
          <Button onClick={save} disabled={pending} className="gap-2">
            <Save className="size-4" />
            {pending ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
          </Button>
          <Button
            variant="outline"
            onClick={destroy}
            disabled={pending}
            className="gap-2 text-destructive"
          >
            <Trash className="size-4" /> Eliminar menú
          </Button>
        </div>
      </aside>
    </div>
  );
}

const LOCATION_NAME: Record<MenuLocation, string> = {
  header: "la cabecera",
  footer: "el pie",
  sidebar: "el lateral",
  custom: "esa ubicación",
};

// ============================================================
// Tree
// ============================================================
function Tree({
  items,
  selectedPath,
  onSelect,
  onMove,
  onAddChild,
  onRemove,
  parentPath = [],
}: {
  items: MenuItem[];
  selectedPath: Path | null;
  onSelect: (path: Path | null) => void;
  onMove: (path: Path, dir: -1 | 1) => void;
  onAddChild: (path: Path, type: MenuItemType) => void;
  onRemove: (path: Path) => void;
  parentPath?: Path;
}) {
  return (
    <ul className={cn("space-y-1.5", parentPath.length > 0 && "ml-4 border-l pl-3")}>
      {items.map((item, i) => {
        const path = [...parentPath, i];
        const isSelected = selectedPath && pathsEqual(selectedPath, path);
        const canHaveChildren = item.type !== "divider" && item.type !== "external";
        return (
          <li key={item.id}>
            <div
              className={cn(
                "group flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-sm transition-colors",
                isSelected ? "border-primary ring-1 ring-primary/40" : "hover:bg-muted/40",
              )}
            >
              <GripVertical className="size-4 text-muted-foreground/50" aria-hidden />
              <button
                type="button"
                className="flex-1 truncate text-left"
                onClick={() => onSelect(isSelected ? null : path)}
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">
                  {item.type}
                </span>
                {item.type === "divider" ? (
                  <span className="text-muted-foreground">— separador —</span>
                ) : (
                  <span className="font-medium">{item.label || "(sin etiqueta)"}</span>
                )}
              </button>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => onMove(path, -1)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Subir"
                >
                  <ChevronDown className="size-3 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(path, 1)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Bajar"
                >
                  <ChevronDown className="size-3" />
                </button>
                {canHaveChildren && depthOf(path) < 2 ? (
                  <AddChildButton onAdd={(t) => onAddChild(path, t)} />
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(path)}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  aria-label="Eliminar"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
            {"children" in item && item.children && item.children.length > 0 ? (
              <Tree
                items={item.children}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onMove={onMove}
                onAddChild={onAddChild}
                onRemove={onRemove}
                parentPath={path}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AddRootButton({ onAdd }: { onAdd: (type: MenuItemType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" className="gap-1" onClick={() => setOpen((v) => !v)}>
        <Plus className="size-3.5" /> Añadir ítem
      </Button>
      {open ? (
        <Popover onClose={() => setOpen(false)}>
          {ITEM_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                onAdd(t.type);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted"
            >
              <t.icon className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.description}</div>
              </div>
            </button>
          ))}
        </Popover>
      ) : null}
    </div>
  );
}

function AddChildButton({ onAdd }: { onAdd: (type: MenuItemType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Añadir hijo"
      >
        <ChevronRight className="size-3" />
      </button>
      {open ? (
        <Popover onClose={() => setOpen(false)} align="right">
          {ITEM_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                onAdd(t.type);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted"
            >
              <t.icon className="mt-0.5 size-4 text-muted-foreground" />
              <div className="font-medium">{t.label}</div>
            </button>
          ))}
        </Popover>
      ) : null}
    </div>
  );
}

function Popover({
  children,
  onClose,
  align = "left",
}: {
  children: React.ReactNode;
  onClose: () => void;
  align?: "left" | "right";
}) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-popover]")) onClose();
    };
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [onClose]);
  return (
    <div
      data-popover
      className={cn(
        "absolute top-full z-30 mt-1 w-60 rounded-xl border bg-popover p-1 shadow-xl",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      {children}
    </div>
  );
}

// ============================================================
// Inspector
// ============================================================
function Inspector({
  item,
  path,
  availablePages,
  availableCollections,
  onPatch,
}: {
  item: MenuItem;
  path: Path;
  availablePages: Array<{ id: string; path: string; title: string }>;
  availableCollections: Array<{ slug: string; name: string }>;
  onPatch: (mut: (item: MenuItem) => MenuItem) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tipo · {item.type}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Profundidad nivel {depthOf(path) + 1} de 3
        </p>
      </div>
      {item.type !== "divider" ? (
        <div className="space-y-1.5">
          <Label htmlFor="i-label">Etiqueta</Label>
          <Input
            id="i-label"
            value={item.label}
            onChange={(e) => onPatch((it) => ({ ...it, label: e.target.value }) as MenuItem)}
          />
        </div>
      ) : null}
      {item.type === "link" ? (
        <div className="space-y-1.5">
          <Label htmlFor="i-href">URL o path</Label>
          <Input
            id="i-href"
            value={item.href}
            onChange={(e) => onPatch((it) => ({ ...it, href: e.target.value }) as MenuItem)}
            placeholder="/about"
          />
        </div>
      ) : null}
      {item.type === "external" ? (
        <div className="space-y-1.5">
          <Label htmlFor="i-href">URL absoluta</Label>
          <Input
            id="i-href"
            value={item.href}
            onChange={(e) => onPatch((it) => ({ ...it, href: e.target.value }) as MenuItem)}
            placeholder="https://"
          />
        </div>
      ) : null}
      {item.type === "page" ? (
        <div className="space-y-1.5">
          <Label htmlFor="i-page">Página</Label>
          <select
            id="i-page"
            value={item.pageId}
            onChange={(e) => onPatch((it) => ({ ...it, pageId: e.target.value }) as MenuItem)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">— Selecciona —</option>
            {availablePages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.path}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {item.type === "collection" ? (
        <div className="space-y-1.5">
          <Label htmlFor="i-coll">Colección</Label>
          <select
            id="i-coll"
            value={item.collectionSlug}
            onChange={(e) =>
              onPatch((it) => ({ ...it, collectionSlug: e.target.value }) as MenuItem)
            }
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">— Selecciona —</option>
            {availableCollections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {item.type !== "divider" ? (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Apariencia
          </Label>
          <div className="space-y-2">
            <FlagToggle
              checked={!!item.highlight}
              onChange={(v) => onPatch((it) => ({ ...it, highlight: v }))}
              label="Destacar (CTA)"
            />
            <FlagToggle
              checked={!!item.muted}
              onChange={(v) => onPatch((it) => ({ ...it, muted: v }))}
              label="Atenuado"
            />
            <FlagToggle
              checked={!!item.newTab}
              onChange={(v) => onPatch((it) => ({ ...it, newTab: v }))}
              label="Abrir en nueva pestaña"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlagToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const id = `flag-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex items-center justify-between text-sm">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
