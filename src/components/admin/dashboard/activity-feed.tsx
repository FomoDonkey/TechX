import { RelativeTime } from "@/components/admin/dashboard/relative-time";
import { Card } from "@/components/ui/card";
import type { ActivityRow } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import {
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FilePlus2,
  History,
  Pencil,
  Trash2,
  UserPlus,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

const ACTION_LABELS: Record<string, { label: string; icon: typeof FilePlus2; tone: string }> = {
  "entry.created": { label: "Creó una entrada", icon: FilePlus2, tone: "text-primary" },
  "entry.updated": { label: "Editó una entrada", icon: Pencil, tone: "text-muted-foreground" },
  "entries.published": { label: "Publicó entradas", icon: CheckCircle2, tone: "text-success" },
  "entries.unpublished": { label: "Despublicó entradas", icon: CircleDashed, tone: "text-warning" },
  "entries.archived": {
    label: "Archivó entradas",
    icon: ArchiveRestore,
    tone: "text-muted-foreground",
  },
  "entry.scheduled": {
    label: "Programó publicación",
    icon: CalendarClock,
    tone: "text-primary",
  },
  "entries.deleted": { label: "Eliminó entradas", icon: Trash2, tone: "text-destructive" },
  "entry.restored": { label: "Restauró revisión", icon: History, tone: "text-accent" },
  "workspace.created": { label: "Creó el workspace", icon: Workflow, tone: "text-primary" },
  "workspace.switched": {
    label: "Cambió de workspace",
    icon: Workflow,
    tone: "text-muted-foreground",
  },
  "member.invited": { label: "Invitó a alguien", icon: UserPlus, tone: "text-primary" },
  "member.joined": { label: "Se unió", icon: UserPlus, tone: "text-success" },
};

function describe(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return { label: action, icon: CircleDashed, tone: "text-muted-foreground" };
}

function metaSummary(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (typeof m.title === "string") return m.title;
  if (typeof m.count === "number") return `${m.count} ${m.count === 1 ? "elemento" : "elementos"}`;
  if (typeof m.name === "string") return m.name;
  return null;
}

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Actividad reciente</h2>
        <span className="text-xs text-muted-foreground">{rows.length} eventos</span>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
            Aún no hay actividad. Cuando crees o publiques contenido aparecerá aquí.
          </li>
        ) : (
          rows.map((r) => {
            const d = describe(r.action);
            const Icon = d.icon;
            const meta = metaSummary(r.meta);
            return (
              <li key={r.id} className="flex items-start gap-3">
                <Avatar name={r.actorName} image={r.actorImage} />
                <div className="flex-1 text-sm">
                  <p>
                    <span className="font-medium">{r.actorName ?? "Alguien"}</span>{" "}
                    <span className="text-muted-foreground">{d.label.toLowerCase()}</span>
                    {meta ? (
                      <>
                        {" "}
                        <span className="text-foreground">· {meta}</span>
                      </>
                    ) : null}
                  </p>
                  <RelativeTime date={r.createdAt} className="text-xs text-muted-foreground" />
                </div>
                <span
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted/40",
                    d.tone,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

function Avatar({ name, image }: { name: string | null; image: string | null }): ReactNode {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={name ?? ""} className="size-7 shrink-0 rounded-full object-cover" />
    );
  }
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] text-[11px] font-bold text-white">
      {initial}
    </span>
  );
}
