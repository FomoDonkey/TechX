"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  CheckCircle2,
  CircleDashed,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelMembershipAction,
  createTierAction,
  deleteTierAction,
  grantManualMembershipAction,
  syncTierToStripeAction,
  updateTierAction,
} from "./_actions";

type TierVM = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: "month" | "year" | "lifetime";
  trialDays: number;
  features: string[];
  isActive: boolean;
  isFree: boolean;
  sortOrder: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  activeMembers: number;
};

type MemberVM = {
  id: string;
  email: string;
  name: string | null;
  tierName: string;
  status: "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
  statusLabel: string;
  currentPeriodEnd: string | null;
  source: string | null;
  createdAt: string;
  cancelAtPeriodEnd: boolean;
};

// ============================================================
// Utils UI
// ============================================================
function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return "Gratis";
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function intervalShort(interval: "month" | "year" | "lifetime"): string {
  return interval === "month" ? "/mes" : interval === "year" ? "/año" : "una vez";
}

const STATUS_BADGE: Record<MemberVM["status"], string> = {
  incomplete: "border-amber-400/40 text-amber-300",
  trialing: "border-violet-400/40 text-violet-300",
  active: "border-emerald-400/40 text-emerald-300",
  past_due: "border-amber-400/40 text-amber-300",
  canceled: "border-muted-foreground/30 text-muted-foreground",
  unpaid: "border-rose-400/40 text-rose-300",
  paused: "border-sky-400/40 text-sky-300",
};

// ============================================================
// TIERS BOARD
// ============================================================
export function TiersBoard({
  tiers,
  stripeAvailable,
}: {
  tiers: TierVM[];
  stripeAvailable: boolean;
}) {
  const [editing, setEditing] = useState<TierVM | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t) => (
          <TierCard
            key={t.id}
            tier={t}
            stripeAvailable={stripeAvailable}
            onEdit={() => setEditing(t)}
            onChanged={() => router.refresh()}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="group flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-card/40 hover:text-foreground"
        >
          <Plus className="size-6" />
          <span className="text-sm font-medium">Nuevo tier</span>
        </button>
      </div>

      {creating ? (
        <TierFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : null}
      {editing ? (
        <TierFormDialog
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function TierCard({
  tier,
  stripeAvailable,
  onEdit,
  onChanged,
}: {
  tier: TierVM;
  stripeAvailable: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function syncStripe() {
    startTransition(async () => {
      const r = await syncTierToStripeAction({ id: tier.id });
      if (!r.ok) {
        alert(
          r.error === "stripe_not_configured"
            ? "Configura STRIPE_SECRET_KEY primero."
            : `Error: ${r.error}`,
        );
        return;
      }
      onChanged();
    });
  }

  function doDelete() {
    startTransition(async () => {
      const r = await deleteTierAction({ id: tier.id });
      if (!r.ok) {
        alert(`Error: ${r.error}`);
        return;
      }
      setConfirmDelete(false);
      onChanged();
    });
  }

  const synced = !!tier.stripePriceId;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card/40 p-5 transition-shadow hover:shadow-lg hover:shadow-black/10",
        !tier.isActive && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{tier.name}</h3>
            {tier.isFree ? <Badge variant="outline">Gratis</Badge> : null}
            {!tier.isActive ? (
              <Badge variant="outline" className="text-muted-foreground">
                Oculto
              </Badge>
            ) : null}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">{tier.slug}</p>
        </div>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={tier.activeMembers > 0}
            title={tier.activeMembers > 0 ? "No se puede borrar: hay miembros activos" : ""}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold">
            {formatPrice(tier.priceCents, tier.currency)}
          </span>
          {tier.priceCents > 0 ? (
            <span className="text-xs text-muted-foreground">{intervalShort(tier.interval)}</span>
          ) : null}
        </div>
        {tier.trialDays > 0 ? (
          <p className="mt-0.5 text-xs text-violet-300">{tier.trialDays} días de prueba</p>
        ) : null}
      </div>

      {tier.description ? (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{tier.description}</p>
      ) : null}

      {tier.features.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {tier.features.slice(0, 4).map((f) => (
            <li key={f} className="flex items-start gap-2 text-foreground/80">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
              <span className="line-clamp-1">{f}</span>
            </li>
          ))}
          {tier.features.length > 4 ? (
            <li className="text-xs text-muted-foreground">+{tier.features.length - 4} más…</li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>
          {tier.activeMembers} {tier.activeMembers === 1 ? "miembro activo" : "miembros activos"}
        </span>
        {tier.isFree ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Sparkles className="size-3" /> Sin Stripe
          </span>
        ) : synced ? (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="size-3" /> Sincronizado
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={syncStripe}
            disabled={!stripeAvailable || isPending}
            className="h-6 gap-1 px-2 text-xs"
            title={!stripeAvailable ? "Configura STRIPE_SECRET_KEY" : ""}
          >
            <Zap className="size-3" />
            {isPending ? "Sincronizando…" : "Sincronizar Stripe"}
          </Button>
        )}
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Borrar tier "${tier.name}"`}
          description="Esta acción no se puede deshacer. Las membresías activas perderán su tier asignado pero seguirán existiendo."
          confirmLabel="Borrar"
          variant="destructive"
          onConfirm={doDelete}
          pending={isPending}
        />
      ) : null}
    </div>
  );
}

// ============================================================
// TIER FORM DIALOG
// ============================================================
function TierFormDialog({
  mode,
  initial,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit";
  initial?: TierVM;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceCents, setPriceCents] = useState(initial?.priceCents ?? 0);
  const [currency, setCurrency] = useState(initial?.currency ?? "eur");
  const [interval, setInterval] = useState<"month" | "year" | "lifetime">(
    initial?.interval ?? "month",
  );
  const [trialDays, setTrialDays] = useState(initial?.trialDays ?? 0);
  const [features, setFeatures] = useState((initial?.features ?? []).join("\n"));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const featuresList = features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        priceCents: Math.max(0, Math.round(priceCents)),
        currency: currency.trim().toLowerCase(),
        interval,
        trialDays: Math.max(0, Math.round(trialDays)),
        features: featuresList,
        isActive,
        sortOrder: Math.round(sortOrder),
      };
      const r =
        mode === "create"
          ? await createTierAction(payload)
          : await updateTierAction({ ...payload, id: initial!.id });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-background/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[160] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-popover p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 max-h-[90vh]">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {mode === "create" ? "Nuevo tier" : `Editar "${initial?.name}"`}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Los tiers gratis se conceden sin Stripe. Los de pago requieren sincronización.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="tier-name">Nombre</Label>
              <Input
                id="tier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Pro, Premium, Insider…"
              />
            </div>
            <div>
              <Label htmlFor="tier-desc">Descripción</Label>
              <Textarea
                id="tier-desc"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Para quién es este plan, qué aporta…"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="tier-price">Precio (céntimos)</Label>
                <Input
                  id="tier-price"
                  type="number"
                  min={0}
                  value={priceCents}
                  onChange={(e) => setPriceCents(Number(e.target.value) || 0)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {priceCents === 0 ? "Plan gratis" : formatPrice(priceCents, currency)}
                </p>
              </div>
              <div>
                <Label htmlFor="tier-curr">Moneda</Label>
                <select
                  id="tier-curr"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="eur">EUR €</option>
                  <option value="usd">USD $</option>
                  <option value="gbp">GBP £</option>
                  <option value="mxn">MXN</option>
                  <option value="brl">BRL</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tier-interval">Intervalo</Label>
                <select
                  id="tier-interval"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as "month" | "year" | "lifetime")}
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                  disabled={priceCents === 0}
                >
                  <option value="month">Mensual</option>
                  <option value="year">Anual</option>
                  <option value="lifetime">Único pago</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tier-trial">Días de prueba</Label>
                <Input
                  id="tier-trial"
                  type="number"
                  min={0}
                  max={365}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value) || 0)}
                  disabled={priceCents === 0 || interval === "lifetime"}
                />
              </div>
              <div>
                <Label htmlFor="tier-order">Orden (asc)</Label>
                <Input
                  id="tier-order"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="tier-features">Beneficios (uno por línea)</Label>
              <Textarea
                id="tier-features"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="Acceso a posts premium&#10;Newsletter exclusiva&#10;Comentarios destacados"
                rows={5}
              />
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="tier-active" />
              <div className="flex-1">
                <Label htmlFor="tier-active" className="cursor-pointer text-sm">
                  Visible en /miembros
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Si lo desactivas, las membresías existentes no se ven afectadas.
                </p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                Error: {error}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button onClick={submit} disabled={isPending || !name.trim()}>
              {isPending ? "Guardando…" : mode === "create" ? "Crear tier" : "Guardar cambios"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ============================================================
// MEMBERS TABLE
// ============================================================
export function MembersTable({
  members,
  tiers,
}: {
  members: MemberVM[];
  tiers: { id: string; name: string; priceLabel: string }[];
}) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MemberVM | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function doCancel(immediate: boolean) {
    if (!cancelTarget) return;
    startTransition(async () => {
      const r = await cancelMembershipAction({ id: cancelTarget.id, immediate });
      if (!r.ok) alert(`Error: ${r.error}`);
      setCancelTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border bg-card/30">
        <div className="flex items-center justify-end border-b p-3">
          <Button size="sm" variant="outline" onClick={() => setGrantOpen(true)}>
            <UserPlus className="mr-1.5 size-3.5" />
            Conceder manualmente
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-left font-medium">Plan</th>
              <th className="px-4 py-2 text-left font-medium">Estado</th>
              <th className="px-4 py-2 text-left font-medium">Renovación</th>
              <th className="px-4 py-2 text-left font-medium">Origen</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-muted/20">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{m.email}</div>
                  {m.name ? <div className="text-xs text-muted-foreground">{m.name}</div> : null}
                </td>
                <td className="px-4 py-2.5">{m.tierName}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className={cn("text-[11px]", STATUS_BADGE[m.status])}>
                    {m.statusLabel}
                  </Badge>
                  {m.cancelAtPeriodEnd ? (
                    <p className="mt-0.5 text-[10px] text-amber-300">
                      cancela al final del período
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {m.currentPeriodEnd ? (
                    new Date(m.currentPeriodEnd).toLocaleDateString("es-ES")
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <CircleDashed className="size-3" />
                      sin caducidad
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {m.source ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {m.status !== "canceled" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-300 hover:text-rose-400"
                      onClick={() => setCancelTarget(m)}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grantOpen ? (
        <GrantMembershipDialog
          tiers={tiers}
          onClose={() => setGrantOpen(false)}
          onSuccess={() => {
            setGrantOpen(false);
            router.refresh();
          }}
        />
      ) : null}
      {cancelTarget ? (
        <CancelMembershipDialog
          target={cancelTarget}
          isPending={isPending}
          onClose={() => setCancelTarget(null)}
          onCancel={doCancel}
        />
      ) : null}
    </>
  );
}

function CancelMembershipDialog({
  target,
  isPending,
  onClose,
  onCancel,
}: {
  target: MemberVM;
  isPending: boolean;
  onClose: () => void;
  onCancel: (immediate: boolean) => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-background/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[160] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-popover p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">
            Cancelar membresía de {target.email}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Elige cuándo termina el acceso. Esta acción se registra en el audit log.
          </Dialog.Description>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => onCancel(false)}
              className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              <div className="font-medium">Cancelar al final del período</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Recomendado. El miembro mantiene acceso hasta{" "}
                {target.currentPeriodEnd
                  ? new Date(target.currentPeriodEnd).toLocaleDateString("es-ES")
                  : "la fecha de renovación actual"}
                .
              </p>
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onCancel(true)}
              className="w-full rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-left transition-colors hover:bg-rose-500/10 disabled:opacity-50"
            >
              <div className="font-medium text-rose-300">Cancelar inmediatamente</div>
              <p className="mt-1 text-xs text-rose-300/80">
                Termina el acceso AHORA. El miembro perderá visibilidad de contenido premium en su
                próxima request.
              </p>
            </button>
          </div>
          <div className="mt-5 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={isPending}>
                Volver
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GrantMembershipDialog({
  tiers,
  onClose,
  onSuccess,
}: {
  tiers: { id: string; name: string; priceLabel: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tierId, setTierId] = useState<string>(tiers[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await grantManualMembershipAction({
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        tierId: tierId || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-background/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[160] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-popover p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">Conceder membresía</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Útil para invitar manualmente, importar usuarios o conceder accesos VIP sin pasar por
            Stripe.
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="grant-email">Email</Label>
              <Input
                id="grant-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@dominio.com"
              />
            </div>
            <div>
              <Label htmlFor="grant-name">Nombre (opcional)</Label>
              <Input id="grant-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="grant-tier">Tier</Label>
              <select
                id="grant-tier"
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Sin plan asignado</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.priceLabel}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                Error: {error}
              </div>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button onClick={submit} disabled={isPending || !email.includes("@")}>
              {isPending ? "Concediendo…" : "Conceder"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
