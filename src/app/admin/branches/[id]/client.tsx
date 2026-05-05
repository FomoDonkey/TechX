"use client";

import {
  abandonBranchAction,
  clearActiveBranchAction,
  clearPreviewTokenAction,
  createBranchCommentAction,
  deleteEntryInBranchAction,
  mergeBranchAction,
  resolveBranchCommentAction,
  revertEntryInBranchAction,
  rotatePreviewTokenAction,
  switchBranchAction,
} from "@/app/admin/branches/_actions";
import type { MergePlan, MergeResolution } from "@/branches/merge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Branch } from "@/db/schema";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  GitMerge,
  Link as LinkIcon,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const VISIBILITY_BADGE: Record<string, { label: string; tone: string }> = {
  forked: {
    label: "Modificada",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  new: {
    label: "Nueva",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  deleted: {
    label: "Borrada",
    tone: "bg-rose-500/15 text-rose-700 dark:text-rose-400 line-through",
  },
  main: {
    label: "Heredada de main",
    tone: "bg-muted text-muted-foreground",
  },
};

export function BranchDetailClient({
  branch,
  isActive,
  plan,
  conflictsCount,
  openCommentsCount,
}: {
  branch: Branch;
  isActive: boolean;
  plan: MergePlan | null;
  conflictsCount: number;
  openCommentsCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showMerge, setShowMerge] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const isMain = branch.isDefault;
  const status = branch.status;

  function activate() {
    start(async () => {
      const result = await switchBranchAction({ branchId: branch.id });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(isMain ? "Has vuelto a main" : `Editando en ${branch.name}`);
        router.refresh();
      }
    });
  }

  function deactivate() {
    start(async () => {
      const result = await clearActiveBranchAction();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Vuelto a main");
        router.refresh();
      }
    });
  }

  function abandon() {
    if (!confirm("¿Abandonar esta branch? Las forks quedarán inaccesibles.")) return;
    start(async () => {
      const result = await abandonBranchAction({ branchId: branch.id });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Branch abandonada");
        router.push("/admin/branches");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isMain && status === "draft" ? (
        <>
          {isActive ? (
            <Button variant="outline" size="sm" onClick={deactivate} disabled={pending}>
              Desactivar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={activate} disabled={pending}>
              <Sparkles className="size-4" />
              Editar en esta branch
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowShare(true)}
            disabled={pending}
            variant="outline"
            className="gap-2"
          >
            <LinkIcon className="size-4" />
            {branch.previewToken ? "Compartir preview" : "Generar preview"}
          </Button>
          <Button size="sm" onClick={() => setShowMerge(true)} disabled={pending} className="gap-2">
            <GitMerge className="size-4" />
            Mergear a main{conflictsCount > 0 ? ` (${conflictsCount} conflictos)` : ""}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={abandon}
            disabled={pending}
            className="gap-2 text-rose-700 dark:text-rose-400"
          >
            <Trash2 className="size-4" />
            Abandonar
          </Button>
        </>
      ) : null}

      {showMerge && plan ? (
        <MergeModal
          plan={plan}
          conflictsCount={conflictsCount}
          openCommentsCount={openCommentsCount}
          onClose={() => setShowMerge(false)}
        />
      ) : null}

      {showShare ? <ShareModal branch={branch} onClose={() => setShowShare(false)} /> : null}
    </div>
  );
}

function MergeModal({
  plan,
  conflictsCount,
  openCommentsCount,
  onClose,
}: {
  plan: MergePlan;
  conflictsCount: number;
  openCommentsCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [resolutions, setResolutions] = useState<Record<string, MergeResolution>>({});

  function setResolution(forkId: string, value: MergeResolution) {
    setResolutions((r) => ({ ...r, [forkId]: value }));
  }

  function execute() {
    start(async () => {
      const result = await mergeBranchAction({
        branchId: plan.branchId,
        resolutions: Object.keys(resolutions).length > 0 ? resolutions : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Merge OK: ${result.promoted} promovidas, ${result.createdInMain} nuevas, ${result.deletedFromMain} borradas`,
      );
      onClose();
      router.push("/admin/branches");
    });
  }

  const conflictItems = plan.conflicts;
  const cleanItems = plan.items.filter((i) => !i.isConflict);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl">
        <header className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <GitMerge className="size-5" />
              Mergear "{plan.branchName}" a main
            </h3>
            <p className="text-xs text-muted-foreground">
              {plan.items.length} entradas afectadas
              {openCommentsCount > 0 ? ` · ${openCommentsCount} comentarios abiertos` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={pending}>
            <X className="size-4" />
          </Button>
        </header>

        {plan.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay cambios que mergear. La branch está sincronizada con main.
          </p>
        ) : (
          <>
            {conflictItems.length > 0 ? (
              <section className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-4" />
                  {conflictsCount} conflictos requieren resolución
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  La entry de main fue editada después de tu fork. Decide qué versión gana.
                </p>
                <ul className="space-y-2">
                  {conflictItems.map((item) => (
                    <li
                      key={item.forkId}
                      className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-xs"
                    >
                      <code className="truncate font-mono">{item.forkId.slice(0, 8)}…</code>
                      <div className="flex gap-1">
                        {(["use_branch", "use_main", "skip"] as const).map((opt) => (
                          <Button
                            key={opt}
                            size="sm"
                            variant={resolutions[item.forkId] === opt ? "default" : "outline"}
                            onClick={() => setResolution(item.forkId, opt)}
                            className="h-7 px-2 text-[10px]"
                          >
                            {opt === "use_branch"
                              ? "Branch gana"
                              : opt === "use_main"
                                ? "Main gana"
                                : "Saltar"}
                          </Button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {cleanItems.length > 0 ? (
              <section className="space-y-2 rounded-xl border bg-muted/20 p-4 text-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Auto-merge ({cleanItems.length})
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {cleanItems.slice(0, 6).map((item) => (
                    <li key={item.forkId} className="flex items-center justify-between">
                      <span className="truncate">{item.forkId.slice(0, 8)}…</span>
                      <Badge variant="outline" className="text-[10px]">
                        {item.defaultAction === "promote"
                          ? "Promover cambios"
                          : item.defaultAction === "create_in_main"
                            ? "Crear en main"
                            : "Borrar de main"}
                      </Badge>
                    </li>
                  ))}
                  {cleanItems.length > 6 ? (
                    <li className="text-center text-[10px]">… y {cleanItems.length - 6} más</li>
                  ) : null}
                </ul>
              </section>
            ) : null}
          </>
        )}

        <footer className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={execute}
            disabled={
              pending ||
              plan.items.length === 0 ||
              (conflictsCount > 0 && conflictItems.some((c) => !resolutions[c.forkId]))
            }
            className="gap-2"
          >
            <GitMerge className="size-4" />
            {pending ? "Mergeando..." : "Confirmar merge"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function ShareModal({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [token, setToken] = useState(branch.previewToken);
  const [password, setPassword] = useState("");
  const [expires, setExpires] = useState<string>("");

  const url = token ? `${window.location.origin}/preview/branch/${token}/` : null;

  function rotate() {
    start(async () => {
      const result = await rotatePreviewTokenAction({
        branchId: branch.id,
        password: password || null,
        expiresAt: expires ? new Date(expires).toISOString() : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setToken(result.token);
      toast.success("Token generado");
      router.refresh();
    });
  }

  function clear() {
    start(async () => {
      const result = await clearPreviewTokenAction({ branchId: branch.id });
      if (!result.ok) toast.error(result.error);
      else {
        setToken(null);
        toast.success("Preview deshabilitado");
        router.refresh();
      }
    });
  }

  function copyUrl() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Copiado"),
      () => toast.error("No se pudo copiar"),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl">
        <header className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Compartir preview</h3>
            <p className="text-xs text-muted-foreground">
              Link público de solo lectura con el contenido en esta branch.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        {url ? (
          <div className="space-y-2">
            <div className="flex gap-1">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={copyUrl}>
                <Copy className="size-4" />
              </Button>
              <Button size="icon" variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Hits: {branch.previewViews}
              {branch.previewExpiresAt
                ? ` · expira ${new Date(branch.previewExpiresAt).toLocaleString("es-ES")}`
                : ""}
              {branch.previewPasswordHash ? " · protegido por contraseña" : ""}
            </p>
          </div>
        ) : null}

        <div className="space-y-3 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {token ? "Rotar token" : "Generar token"}
          </p>
          <div className="space-y-2">
            <Input
              placeholder="Contraseña opcional"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              maxLength={80}
            />
            <Input
              placeholder="Expira en (opcional)"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              type="datetime-local"
            />
          </div>
          <div className="flex justify-end gap-2">
            {token ? (
              <Button variant="ghost" onClick={clear} disabled={pending}>
                Deshabilitar
              </Button>
            ) : null}
            <Button onClick={rotate} disabled={pending}>
              {pending ? "Generando..." : token ? "Rotar token" : "Generar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type EntryRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  visibility: "main" | "forked" | "new" | "deleted";
  originalEntryId: string | null;
  originalTitle: string | null;
  isConflict: boolean;
};

BranchDetailClient.Entries = function Entries({
  branchId,
  rows,
}: {
  branchId: string;
  rows: EntryRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openDiff, setOpenDiff] = useState<string | null>(null);

  const visible = rows.filter((r) => r.visibility !== "main");
  const main = rows.filter((r) => r.visibility === "main");

  function revert(entryId: string) {
    if (!confirm("¿Descartar los cambios de esta entrada en la branch?")) return;
    start(async () => {
      const result = await revertEntryInBranchAction({ branchId, entryId });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Cambios descartados");
        router.refresh();
      }
    });
  }

  function deleteInBranch(entryId: string) {
    if (!confirm("¿Marcar como borrada en la branch? Al merge desaparecerá de main.")) return;
    start(async () => {
      const result = await deleteEntryInBranchAction({ branchId, entryId });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Marcada como borrada");
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Cambios de esta branch ({visible.length})
        </h2>
        {main.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            +{main.length} entradas heredadas de main
          </span>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          La branch está limpia. Edita una entrada existente o crea una nueva con esta branch activa
          para empezar.
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {visible.map((entry) => {
            const meta = VISIBILITY_BADGE[entry.visibility] ?? VISIBILITY_BADGE.main;
            const showingDiff = openDiff === entry.id;
            return (
              <li key={entry.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${meta?.tone} text-[10px]`}>{meta?.label}</Badge>
                  {entry.isConflict ? (
                    <Badge className="gap-1 bg-orange-500/15 text-orange-800 dark:text-orange-300 text-[10px]">
                      <AlertTriangle className="size-3" />
                      conflicto
                    </Badge>
                  ) : null}
                  <Link
                    href={`/admin/contenido/${entry.id}`}
                    className="flex-1 truncate font-medium hover:text-primary"
                  >
                    {entry.title || "Sin título"}
                  </Link>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {entry.slug.replace(/__b-[^/]+$/, "")}
                  </code>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(entry.updatedAt).toLocaleString("es-ES")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {entry.visibility !== "deleted" && entry.originalEntryId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => setOpenDiff(showingDiff ? null : entry.id)}
                    >
                      {showingDiff ? "Ocultar diff" : "Ver diff"}
                    </Button>
                  ) : null}
                  {entry.visibility === "forked" || entry.visibility === "new" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-[11px] text-rose-700 dark:text-rose-400"
                      onClick={() => deleteInBranch(entry.id)}
                      disabled={pending}
                    >
                      <Trash2 className="size-3" />
                      Borrar en branch
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => revert(entry.id)}
                    disabled={pending}
                  >
                    <RotateCcw className="size-3" />
                    Descartar
                  </Button>
                </div>
                {showingDiff ? <DiffPanel branchId={branchId} entryId={entry.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

function DiffPanel({ branchId, entryId }: { branchId: string; entryId: string }) {
  const [data, setData] = useState<{
    diff: {
      blocks: Array<{
        kind: string;
        left?: { type: string; text: string };
        right?: { type: string; text: string };
        textDiff?: Array<{ value: string; added?: boolean; removed?: boolean }>;
      }>;
      meta: Array<{ field: string; changed: boolean; left: unknown; right: unknown }>;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load on mount
  useState(() => {
    fetch(`/api/admin/branches/${branchId}/diff?entry=${entryId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("No se pudo cargar el diff"));
  });

  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!data) return <p className="text-xs text-muted-foreground">Cargando diff…</p>;

  const metaChanges = data.diff.meta.filter((m) => m.changed);

  return (
    <div className="space-y-4 rounded-xl border bg-background p-4 text-xs">
      {metaChanges.length > 0 ? (
        <div className="space-y-1">
          <p className="font-medium uppercase tracking-wider text-muted-foreground">Meta</p>
          {metaChanges.map((m) => (
            <div key={m.field} className="flex flex-wrap items-baseline gap-2 font-mono">
              <span className="text-muted-foreground">{m.field}:</span>
              <span className="rounded bg-rose-500/10 px-1 text-rose-700 line-through dark:text-rose-400">
                {String(m.left ?? "—").slice(0, 60)}
              </span>
              <span>→</span>
              <span className="rounded bg-emerald-500/10 px-1 text-emerald-700 dark:text-emerald-400">
                {String(m.right ?? "—").slice(0, 60)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="font-medium uppercase tracking-wider text-muted-foreground">
          Bloques ({data.diff.blocks.filter((b) => b.kind !== "unchanged").length} cambios)
        </p>
        <ul className="space-y-1.5">
          {data.diff.blocks.map((block, idx) => {
            if (block.kind === "unchanged") return null;
            const blockKey = `${block.kind}:${idx}:${
              block.kind === "removed"
                ? (block.left?.text?.slice(0, 12) ?? "")
                : (block.right?.text?.slice(0, 12) ?? "")
            }`;
            if (block.kind === "added") {
              return (
                <li
                  key={blockKey}
                  className="flex gap-2 rounded border-l-2 border-emerald-500 bg-emerald-500/5 p-2"
                >
                  <Badge className="bg-emerald-500/15 text-emerald-700 text-[9px] dark:text-emerald-400">
                    + {block.right?.type}
                  </Badge>
                  <span className="flex-1 truncate">{block.right?.text || "—"}</span>
                </li>
              );
            }
            if (block.kind === "removed") {
              return (
                <li
                  key={blockKey}
                  className="flex gap-2 rounded border-l-2 border-rose-500 bg-rose-500/5 p-2 opacity-70"
                >
                  <Badge className="bg-rose-500/15 text-rose-700 text-[9px] dark:text-rose-400 line-through">
                    − {block.left?.type}
                  </Badge>
                  <span className="flex-1 truncate line-through">{block.left?.text || "—"}</span>
                </li>
              );
            }
            return (
              <li key={blockKey} className="rounded border-l-2 border-amber-500 bg-amber-500/5 p-2">
                <Badge className="mb-1 bg-amber-500/15 text-amber-700 text-[9px] dark:text-amber-400">
                  ≈ {block.right?.type}
                </Badge>
                <p className="leading-relaxed">
                  {(block.textDiff ?? []).map((part, i) => (
                    <span
                      key={`${blockKey}:p${i}:${part.value.slice(0, 8)}`}
                      className={
                        part.added
                          ? "rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : part.removed
                            ? "rounded bg-rose-500/15 text-rose-700 line-through dark:text-rose-400"
                            : ""
                      }
                    >
                      {part.value}
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

type ActivityRow = {
  id: string;
  type: string;
  createdAt: string;
  actorName: string;
  actorImage: string | null;
  payload: Record<string, unknown> | null;
};
type CommentRow = {
  id: string;
  body: string;
  createdAt: string;
  status: string;
  authorName: string;
  authorImage: string | null;
  entryId: string | null;
  parentId: string | null;
};

const ACTIVITY_LABEL: Record<string, string> = {
  "branch.created": "creó la branch",
  "branch.renamed": "renombró la branch",
  "branch.protected_changed": "cambió protección",
  "branch.preview_token_rotated": "rotó preview token",
  "branch.rebased": "rebaseó",
  "branch.merge_attempted": "intentó merge",
  "branch.merge_failed": "merge falló",
  "branch.merged": "mergeó la branch",
  "branch.abandoned": "abandonó la branch",
  "branch.restored": "restauró la branch",
  "entry.forked": "forkeó una entrada",
  "entry.edited": "editó una entrada",
  "entry.created_in_branch": "creó una entrada nueva",
  "entry.deleted_in_branch": "borró una entrada",
  "entry.reverted_in_branch": "descartó cambios",
  "comment.added": "comentó",
  "comment.resolved": "resolvió un comentario",
};

BranchDetailClient.ActivityAndComments = function ActivityAndComments({
  branchId,
  activity,
  comments,
}: {
  branchId: string;
  activity: ActivityRow[];
  comments: CommentRow[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [tab, setTab] = useState<"activity" | "comments">(
    comments.filter((c) => c.status === "open").length > 0 ? "comments" : "activity",
  );
  const [newComment, setNewComment] = useState("");

  function postComment() {
    const body = newComment.trim();
    if (!body) return;
    start(async () => {
      const result = await createBranchCommentAction({ branchId, body });
      if (!result.ok) toast.error(result.error);
      else {
        setNewComment("");
        toast.success("Comentario añadido");
        router.refresh();
      }
    });
  }

  function resolveComment(commentId: string) {
    start(async () => {
      const result = await resolveBranchCommentAction({ branchId, commentId });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
      <div className="space-y-3">
        <div className="flex gap-1 rounded-xl border bg-muted/30 p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("activity")}
            className={`flex-1 rounded-lg px-3 py-1.5 ${
              tab === "activity" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Actividad ({activity.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("comments")}
            className={`flex-1 rounded-lg px-3 py-1.5 ${
              tab === "comments" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Comentarios ({comments.length})
          </button>
        </div>

        {tab === "activity" ? (
          <ul className="space-y-2">
            {activity.length === 0 ? (
              <li className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                Sin actividad todavía.
              </li>
            ) : (
              activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-xl border bg-card/40 p-3 text-xs"
                >
                  <div className="size-7 shrink-0 rounded-full bg-muted text-center text-[10px] leading-7">
                    {a.actorName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p>
                      <span className="font-medium">{a.actorName}</span>{" "}
                      <span className="text-muted-foreground">
                        {ACTIVITY_LABEL[a.type] ?? a.type}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("es-ES")}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border bg-card/40 p-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Añade un comentario sobre esta branch…"
                rows={3}
                maxLength={4000}
                className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
              />
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={postComment} disabled={!newComment.trim()}>
                  <MessageSquare className="size-3.5" />
                  Comentar
                </Button>
              </div>
            </div>
            <ul className="space-y-2">
              {comments.length === 0 ? (
                <li className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                  Sin comentarios.
                </li>
              ) : (
                comments.map((c) => (
                  <li
                    key={c.id}
                    className={`flex items-start gap-3 rounded-xl border bg-card/40 p-3 text-xs ${
                      c.status === "resolved" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="size-7 shrink-0 rounded-full bg-muted text-center text-[10px] leading-7">
                      {c.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{c.authorName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString("es-ES")}
                        </span>
                        {c.status === "resolved" ? (
                          <Badge variant="secondary" className="gap-1 text-[9px]">
                            <CheckCircle2 className="size-2.5" />
                            resuelto
                          </Badge>
                        ) : null}
                      </div>
                      <p className="leading-relaxed">{c.body}</p>
                      {c.status === "open" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 px-2 text-[10px]"
                          onClick={() => resolveComment(c.id)}
                        >
                          <Check className="size-3" />
                          Resolver
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      <aside className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Sobre branching
        </h3>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            • Editar una entrada de main desde aquí la <strong>forkea</strong> automáticamente.
          </li>
          <li>• El preview público es read-only y rotable.</li>
          <li>• El merge avisa de conflictos si main cambió desde tu fork.</li>
          <li>• Borrar en branch crea un tombstone — desaparece de main al merge.</li>
        </ul>
      </aside>
    </section>
  );
};
