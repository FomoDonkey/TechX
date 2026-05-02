"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, KeyRound, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createKeyAction, deleteKeyAction, revokeKeyAction, rotateKeyAction } from "./_actions";

type ApiKeyRow = {
  id: string;
  name: string;
  description: string | null;
  prefix: string;
  environment: string;
  scopes: string[] | null;
  rateLimit: number;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  requestsToday: number;
  requestsTotal: number;
  createdAt: string;
};

const SCOPE_GROUPS = [
  { resource: "entries", label: "Entradas" },
  { resource: "collections", label: "Colecciones" },
  { resource: "media", label: "Media" },
  { resource: "pages", label: "Páginas" },
  { resource: "comments", label: "Comentarios" },
  { resource: "taxonomies", label: "Taxonomías" },
];

const SCOPE_PRESETS: Array<{ label: string; scopes: string[]; description: string }> = [
  {
    label: "Solo lectura",
    scopes: ["*:read"],
    description: "GET en todos los recursos",
  },
  {
    label: "Lectura + escritura de contenido",
    scopes: ["entries:*", "collections:read", "media:read"],
    description: "Crea/edita entries; lee colecciones y media",
  },
  {
    label: "Acceso completo",
    scopes: ["*"],
    description: "Sin restricciones — usar con cuidado",
  },
];

function formatRel(iso: string | null) {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "ahora";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} h`;
  return `${Math.floor(diff / 86400_000)} d`;
}

export function ApiKeysClient({
  initialKeys,
  workspaceSlug: _workspaceSlug,
}: {
  initialKeys: ApiKeyRow[];
  workspaceSlug: string;
}) {
  const [keys] = useState(initialKeys);
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: string; fullKey: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {keys.length} {keys.length === 1 ? "key" : "keys"}
        </p>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="size-4" /> Nueva API key
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <KeyRound className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Aún no hay API keys. Crea una para conectar tu sitio o aplicaciones externas.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card/30">
          {keys.map((k) => (
            <ApiKeyRowItem key={k.id} k={k} />
          ))}
        </ul>
      )}

      <CreateKeyDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(result) => {
          setRevealedKey(result);
          setCreating(false);
          // Force a reload to refetch keys list. Since this is a small list we bias for simplicity.
          location.reload();
        }}
      />
      {revealedKey ? (
        <RevealKeyDialog fullKey={revealedKey.fullKey} onClose={() => setRevealedKey(null)} />
      ) : null}
    </div>
  );
}

function ApiKeyRowItem({ k }: { k: ApiKeyRow }) {
  const [pending, start] = useTransition();
  const isExpired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now();
  const isRevoked = !!k.revokedAt;
  const status = isRevoked ? "revoked" : isExpired ? "expired" : "active";

  function handleRotate() {
    start(async () => {
      const r = await rotateKeyAction(k.id);
      if (r.ok) {
        toast.success("Key rotada — guarda la nueva, la antigua expira en 24h");
        // Mostramos la nueva key
        prompt("Nueva API key (cópiala ahora, no se mostrará otra vez):", r.fullKey);
        location.reload();
      } else toast.error(r.error);
    });
  }
  function handleRevoke() {
    if (!confirm(`¿Revocar la key "${k.name}"? El acceso se corta inmediatamente.`)) return;
    start(async () => {
      const r = await revokeKeyAction(k.id);
      if (r.ok) {
        toast.success("Key revocada");
        location.reload();
      } else toast.error(r.error);
    });
  }
  function handleDelete() {
    if (!confirm("¿Eliminar definitivamente? Esto borra también el audit log.")) return;
    start(async () => {
      const r = await deleteKeyAction(k.id);
      if (r.ok) {
        toast.success("Key eliminada");
        location.reload();
      } else toast.error(r.error);
    });
  }

  const fullPrefix =
    k.environment === "test"
      ? `csm_test_${k.prefix}_•••••••••••••••••••••`
      : `csm_live_${k.prefix}_•••••••••••••••••••••`;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{k.name}</span>
          <Badge
            variant={k.environment === "live" ? "default" : "secondary"}
            className="text-[10px] uppercase tracking-wider"
          >
            {k.environment}
          </Badge>
          {status === "revoked" ? (
            <Badge variant="destructive" className="text-[10px]">
              Revocada
            </Badge>
          ) : status === "expired" ? (
            <Badge variant="outline" className="text-[10px]">
              Expirada
            </Badge>
          ) : null}
        </div>
        <code className="block truncate font-mono text-xs text-muted-foreground">{fullPrefix}</code>
        <div className="flex flex-wrap gap-1.5">
          {(k.scopes ?? []).map((s) => (
            <Badge key={s} variant="outline" className="text-[10px] font-mono">
              {s}
            </Badge>
          ))}
        </div>
        {k.description ? <p className="text-xs text-muted-foreground">{k.description}</p> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            Hoy: <strong className="text-foreground">{k.requestsToday}</strong>
          </span>
          <span>
            Total: <strong className="text-foreground">{k.requestsTotal}</strong>
          </span>
          <span>
            Rate-limit: <strong className="text-foreground">{k.rateLimit}/h</strong>
          </span>
          <span>
            Última: <strong className="text-foreground">{formatRel(k.lastUsedAt)}</strong>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRotate}
          disabled={pending || status !== "active"}
          title="Rotar"
        >
          <RefreshCw className="size-4" />
        </Button>
        {status === "active" ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRevoke}
            disabled={pending}
            title="Revocar"
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={pending}
          title="Eliminar"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreated: (result: { id: string; fullKey: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [scopes, setScopes] = useState<string[]>(["*:read"]);
  const [rateLimit, setRateLimit] = useState(1000);
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, start] = useTransition();

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Pon un nombre");
      return;
    }
    start(async () => {
      const r = await createKeyAction({
        name: name.trim(),
        description: description.trim() || undefined,
        scopes,
        rateLimit,
        environment,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (r.ok) {
        onCreated({ id: r.id, fullKey: r.fullKey });
        // reset
        setName("");
        setDescription("");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">Nueva API key</Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            La key se mostrará una sola vez tras crearla.
          </Dialog.Description>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Nombre</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mi sitio Astro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key-desc">Descripción (opcional)</Label>
              <Input
                id="key-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Para qué sirve esta key"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entorno</Label>
                <div className="flex gap-1.5">
                  {(["live", "test"] as const).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEnvironment(e)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider",
                        environment === e
                          ? "border-primary bg-primary/10 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-rate">Rate-limit /h</Label>
                <Input
                  id="key-rate"
                  type="number"
                  min={1}
                  max={100000}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expira (opcional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Presets</Label>
              <div className="flex flex-wrap gap-1.5">
                {SCOPE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setScopes(p.scopes)}
                    title={p.description}
                    className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-muted"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {SCOPE_GROUPS.flatMap((g) =>
                  ["read", "write"].map((action) => {
                    const scope = `${g.resource}:${action}`;
                    const checked = scopes.includes(scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => toggleScope(scope)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs",
                          checked
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:border-border",
                        )}
                      >
                        <span className="font-mono">{scope}</span>
                        {checked ? <Check className="size-3.5 text-primary" /> : null}
                      </button>
                    );
                  }),
                )}
                <button
                  type="button"
                  onClick={() => setScopes(["*"])}
                  className={cn(
                    "col-span-2 rounded-lg border px-2.5 py-1.5 text-xs",
                    scopes.includes("*") ? "border-primary bg-primary/10" : "border-dashed",
                  )}
                >
                  <span className="font-mono">*</span> &nbsp;— Acceso total (admin)
                </button>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? "Creando…" : "Crear key"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RevealKeyDialog({ fullKey, onClose }: { fullKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(fullKey);
    setCopied(true);
    toast.success("Copiada al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Dialog.Root open onOpenChange={(b) => !b && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">Tu nueva API key</Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-xs text-muted-foreground">
            Cópiala ahora. No vamos a volver a mostrarla — si la pierdes, tendrás que rotarla.
          </Dialog.Description>
          <div className="rounded-xl border bg-background/60 p-3">
            <code className="block break-all font-mono text-sm">{fullKey}</code>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={copy} className="gap-2">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copiada" : "Copiar"}
            </Button>
            <Button onClick={onClose}>Listo</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
