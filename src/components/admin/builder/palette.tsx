"use client";

import { BLOCK_SPECS, blocksByGroup } from "@/blocks/registry";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

function lucide(name: string) {
  const Cmp = (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[name];
  return Cmp ?? Icons.Square;
}

export function BlockPalette({
  onAdd,
}: {
  onAdd: (kind: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return blocksByGroup();
    const out: Record<string, typeof BLOCK_SPECS> = {};
    for (const s of BLOCK_SPECS) {
      if (s.label.toLowerCase().includes(term) || s.description.toLowerCase().includes(term)) {
        if (!out[s.group]) out[s.group] = [];
        out[s.group]!.push(s);
      }
    }
    return out as Record<string, typeof BLOCK_SPECS>;
  }, [q]);

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-r bg-background/40">
      <div className="border-b px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar bloque…"
            className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {Object.entries(filtered).map(([group, items]) => (
          <div key={group}>
            <div className="mb-1.5 px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((s) => {
                const Icon = lucide(s.icon);
                return (
                  <button
                    key={s.kind}
                    type="button"
                    onClick={() => onAdd(s.kind)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/csm-block-kind", s.kind);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className={cn(
                      "group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border bg-card/50 p-2 text-center transition-colors",
                      "hover:border-primary/40 hover:bg-card/90",
                    )}
                    title={s.description}
                  >
                    <Icon className="size-5 text-foreground/70 transition-colors group-hover:text-primary" />
                    <span className="text-[10.5px] font-medium leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(filtered).length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Sin resultados para “{q}”.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
