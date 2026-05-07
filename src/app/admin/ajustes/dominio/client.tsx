"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type DomainRow = {
  id: string;
  domain: string;
  verifyToken: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
};

type Props = {
  workspaceSlug: string;
  workspaceName: string;
  customDomainPrimary: string | null;
  customDomains: DomainRow[];
  rootDomain: string | null;
  subdomainAvailable: boolean;
  /**
   * True cuando solo hay 1 workspace en la instancia y no hay ROOT_DOMAIN.
   * Cambia el discurso de la UI: la URL es la base sin prefijo `/s/<slug>`,
   * y el editor de slug se reframea como "Identificador" (explicando que
   * solo importa al añadir más sitios).
   */
  isSingleTenant: boolean;
  baseAppUrl: string;
  initialPublicUrl: string;
};

type CheckStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; selfMatch: boolean }
  | { kind: "error"; message: string };

export function DomainClient(props: Props) {
  const [slug, setSlug] = useState(props.workspaceSlug);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<CheckStatus>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Domains state
  const [domains, setDomains] = useState<DomainRow[]>(props.customDomains);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [showAddDomain, setShowAddDomain] = useState(false);

  // ── Live preview URL según el slug que está escribiendo ──
  const previewUrl = useMemo(() => {
    const safeSlug = slug || props.workspaceSlug;
    if (props.subdomainAvailable && props.rootDomain) {
      const proto = props.rootDomain.startsWith("localhost") ? "http" : "https";
      return `${proto}://${safeSlug}.${props.rootDomain}`;
    }
    if (props.isSingleTenant) {
      // Single-tenant: el cambio de slug no afecta la URL pública mientras
      // siga siendo el único sitio. El preview es la URL canónica actual.
      return props.baseAppUrl;
    }
    return `${props.baseAppUrl}/s/${safeSlug}`;
  }, [
    slug,
    props.workspaceSlug,
    props.subdomainAvailable,
    props.rootDomain,
    props.baseAppUrl,
    props.isSingleTenant,
  ]);

  // ── Comprobación de disponibilidad con debounce ──
  useEffect(() => {
    if (!editing) return;
    if (slug === props.workspaceSlug) {
      setStatus({ kind: "idle" });
      return;
    }
    if (!slug.trim()) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "checking" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/domain/slug-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const data = (await res.json()) as
          | { ok: true; available: boolean; selfMatch: boolean }
          | { ok: false; reason: string; message: string };
        if (!data.ok) {
          setStatus({ kind: "error", message: data.message ?? "No disponible" });
        } else {
          setStatus({ kind: "ok", selfMatch: data.selfMatch });
        }
      } catch {
        setStatus({ kind: "error", message: "Error de conexión" });
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [slug, editing, props.workspaceSlug]);

  async function handleSaveSlug() {
    if (saving || status.kind !== "ok" || status.selfMatch) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/domain/slug", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as
        | { ok: true; oldSlug: string; newSlug: string }
        | { ok: false; reason: string; message: string };
      if (!data.ok) {
        setStatus({ kind: "error", message: data.message ?? "Error al guardar" });
        return;
      }
      setSavedToast(`URL actualizada · ${data.oldSlug} → ${data.newSlug}`);
      setEditing(false);
      setStatus({ kind: "idle" });
      // Hard refresh para que server-side recargue el workspace.
      // Guardamos el timeout id por si el user cancela antes de que se dispare.
      reloadTimeoutRef.current = setTimeout(() => window.location.reload(), 600);
    } catch {
      setStatus({ kind: "error", message: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setSlug(props.workspaceSlug);
    setEditing(false);
    setStatus({ kind: "idle" });
    // Cancela el reload programado si el user había guardado y luego cancela.
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(props.initialPublicUrl);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1800);
    } catch {
      /* clipboard bloqueado en algunos navegadores → ignora */
    }
  }

  // ── Custom domain: añadir ──
  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setDomainError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/domain/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const data = (await res.json()) as
        | { ok: true; domain: DomainRow }
        | { ok: false; reason: string; message: string };
      if (!data.ok) {
        setDomainError(data.message ?? "No se pudo añadir");
        return;
      }
      setDomains((prev) => [...prev, data.domain]);
      setNewDomain("");
      setShowAddDomain(false);
    } catch {
      setDomainError("Error de conexión");
    } finally {
      setAdding(false);
    }
  }

  async function handleVerifyDomain(id: string) {
    setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, lastCheckError: null } : d)));
    try {
      const res = await fetch(`/api/admin/domain/custom/${id}/verify`, { method: "POST" });
      const data = (await res.json()) as
        | { ok: true; domain: DomainRow }
        | { ok: false; reason: string; message: string };
      setDomains((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          if (data.ok) return data.domain;
          return {
            ...d,
            lastCheckedAt: new Date().toISOString(),
            lastCheckError: data.message ?? data.reason,
          };
        }),
      );
    } catch {
      setDomains((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, lastCheckedAt: new Date().toISOString(), lastCheckError: "Error de conexión" }
            : d,
        ),
      );
    }
  }

  async function handleRemoveDomain(id: string) {
    if (!confirm("¿Quitar este dominio? Dejará de servir tu sitio.")) return;
    try {
      const res = await fetch(`/api/admin/domain/custom/${id}`, { method: "DELETE" });
      if (res.ok) setDomains((prev) => prev.filter((d) => d.id !== id));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      {/* ── 1) URL pública gratis ───────────────────────────── */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Globe className="size-4 text-emerald-500" />
              URL pública gratis
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Siempre activa. Sin coste. Compártela con quien quieras.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3" />
            Activa
          </span>
        </div>

        {/* URL preview con slug editable */}
        <div className="rounded-lg border bg-background p-4">
          {!editing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <a
                  href={props.initialPublicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-w-0 flex-1 items-center gap-2 overflow-hidden font-mono text-sm hover:text-foreground"
                >
                  <span className="truncate">{props.initialPublicUrl}</span>
                  <ExternalLink className="size-3.5 flex-shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                </a>
                <div className="flex flex-shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyUrl}
                    className="h-8 gap-1.5 px-2.5 text-xs"
                  >
                    {copyOk ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copyOk ? "Copiada" : "Copiar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(true)}
                    className="h-8 gap-1.5 px-2.5 text-xs"
                  >
                    <Pencil className="size-3.5" />
                    {props.isSingleTenant ? "Identificador" : "Cambiar"}
                  </Button>
                </div>
              </div>
              {props.isSingleTenant && (
                <p className="text-[11px] text-muted-foreground">
                  Como solo tienes este sitio, sale en la URL base sin prefijo. El identificador (
                  <code className="rounded bg-muted px-1">{props.workspaceSlug}</code>) solo
                  aparecerá en la URL si añades más sitios.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {props.isSingleTenant
                  ? "Identificador del sitio (uso interno mientras solo tengas este sitio):"
                  : "Tu URL será pública en:"}
              </div>
              <div className="flex items-stretch gap-0 overflow-hidden rounded-lg border bg-background font-mono text-sm">
                {props.subdomainAvailable && props.rootDomain ? (
                  <>
                    <span className="flex items-center bg-muted/40 px-2.5 text-muted-foreground">
                      https://
                    </span>
                    <Input
                      autoFocus
                      value={slug}
                      onChange={(e) => setSlug(normalizeSlugInput(e.target.value))}
                      placeholder="mi-blog"
                      className="rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
                      maxLength={30}
                    />
                    <span className="flex items-center bg-muted/40 px-2.5 text-muted-foreground">
                      .{props.rootDomain}
                    </span>
                  </>
                ) : props.isSingleTenant ? (
                  <Input
                    autoFocus
                    value={slug}
                    onChange={(e) => setSlug(normalizeSlugInput(e.target.value))}
                    placeholder="mi-blog"
                    className="rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
                    maxLength={30}
                  />
                ) : (
                  <>
                    <span className="flex items-center bg-muted/40 px-2.5 text-muted-foreground">
                      {props.baseAppUrl}/s/
                    </span>
                    <Input
                      autoFocus
                      value={slug}
                      onChange={(e) => setSlug(normalizeSlugInput(e.target.value))}
                      placeholder="mi-blog"
                      className="rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
                      maxLength={30}
                    />
                  </>
                )}
              </div>

              {/* Status indicator */}
              <StatusLine status={status} slug={slug} originalSlug={props.workspaceSlug} />

              {/* Acciones */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-muted-foreground/80">
                  {props.isSingleTenant
                    ? "Cambia el identificador en cualquier momento. No afecta la URL pública mientras solo tengas este sitio."
                    : "Las URLs viejas seguirán funcionando 30 días con redirección."}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveSlug}
                    disabled={saving || status.kind !== "ok" || status.selfMatch}
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pequeño preview de cómo cambiará la URL antes de guardar */}
        {editing && status.kind === "ok" && !status.selfMatch && !props.isSingleTenant && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <ArrowRight className="size-3 text-emerald-600" />
            <span className="font-mono text-emerald-700 dark:text-emerald-400">{previewUrl}</span>
          </div>
        )}

        {savedToast && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            {savedToast}
          </div>
        )}
      </section>

      {/* ── 2) Dominio propio (opcional) ────────────────────── */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Dominio propio (opcional)</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Si compraste un dominio (~10 €/año), conéctalo aquí para que tu sitio salga en{" "}
              <code className="rounded bg-muted px-1 text-[11px]">tudominio.com</code> en vez de la
              URL gratis.
            </p>
          </div>
        </div>

        {domains.length === 0 && !showAddDomain && (
          <button
            type="button"
            onClick={() => setShowAddDomain(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm text-muted-foreground transition hover:border-foreground/30 hover:bg-muted/30 hover:text-foreground"
          >
            <Plus className="size-4" />
            Conectar mi dominio
          </button>
        )}

        {showAddDomain && (
          <form onSubmit={handleAddDomain} className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                placeholder="miblog.com"
                disabled={adding}
                className="font-mono"
              />
              <Button type="submit" disabled={adding || !newDomain.trim()}>
                {adding ? <Loader2 className="size-3.5 animate-spin" /> : "Añadir"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowAddDomain(false);
                  setNewDomain("");
                  setDomainError(null);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
            {domainError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3" />
                {domainError}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Sin <code className="rounded bg-muted px-1">https://</code>, sin barras. Ejemplo:{" "}
              <code className="rounded bg-muted px-1">miblog.com</code> o{" "}
              <code className="rounded bg-muted px-1">blog.miempresa.com</code>.
            </p>
          </form>
        )}

        {domains.length > 0 && (
          <div className="space-y-3">
            {domains.map((d) => (
              <DomainCard
                key={d.id}
                domain={d}
                isPrimary={d.domain === props.customDomainPrimary}
                rootDomain={props.rootDomain}
                onVerify={() => handleVerifyDomain(d.id)}
                onRemove={() => handleRemoveDomain(d.id)}
              />
            ))}
            {!showAddDomain && (
              <button
                type="button"
                onClick={() => setShowAddDomain(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <Plus className="size-3" />
                Añadir otro dominio
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── 3) Decisión: cuál usar ─────────────────────────── */}
      <section className="rounded-xl border bg-muted/20 p-5">
        <h2 className="mb-3 text-sm font-semibold">¿Qué URL uso?</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 flex-shrink-0 text-emerald-500" />
            <span>
              <strong>Solo quiero compartir y ya:</strong> usa la URL gratis. Funciona desde
              cualquier PC y móvil del mundo.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 flex-shrink-0 text-emerald-500" />
            <span>
              <strong>Quiero URL más profesional o memorable:</strong> compra un dominio en
              Cloudflare/Namecheap (~10 €/año) y conéctalo arriba.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-3.5 flex-shrink-0 text-emerald-500" />
            <span>
              <strong>Tengo varios sitios:</strong> cada uno tiene su propio nombre. La URL gratis
              te da una distinta por sitio sin pagar.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function StatusLine({
  status,
  slug,
  originalSlug,
}: {
  status: CheckStatus;
  slug: string;
  originalSlug: string;
}) {
  if (slug === originalSlug) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Ese ya es tu nombre actual.
      </p>
    );
  }
  if (status.kind === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Comprobando disponibilidad…
      </p>
    );
  }
  if (status.kind === "ok") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" />
        Disponible
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="size-3" />
        {status.message}
      </p>
    );
  }
  return null;
}

function DomainCard({
  domain,
  isPrimary,
  rootDomain,
  onVerify,
  onRemove,
}: {
  domain: DomainRow;
  isPrimary: boolean;
  rootDomain: string | null;
  onVerify: () => void;
  onRemove: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const verified = Boolean(domain.verifiedAt);

  async function handleVerify() {
    setVerifying(true);
    await onVerify();
    setVerifying(false);
  }

  // CNAME target: si hay rootDomain → ése. Si no → vercel-dns como fallback.
  const cnameTarget = rootDomain ?? "cname.vercel-dns.com";

  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-4",
        verified ? "border-emerald-500/30" : "border-amber-500/30",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Globe
            className={cn("size-4 flex-shrink-0", verified ? "text-emerald-500" : "text-amber-500")}
          />
          <span className="truncate font-mono text-sm font-medium">{domain.domain}</span>
          {isPrimary && (
            <span className="rounded-full border border-foreground/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Principal
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Verificado
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleVerify}
              disabled={verifying}
              className="h-7 gap-1.5 text-xs"
            >
              {verifying ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              {verifying ? "Verificando…" : "Verificar"}
            </Button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Quitar dominio"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {!verified && (
        <div className="space-y-3 rounded-lg bg-muted/30 p-3 text-xs">
          <p className="font-medium text-foreground">
            Configura el DNS en tu registrador (Cloudflare, Namecheap, etc.):
          </p>
          <div className="space-y-2">
            <DnsRecord
              label="Opción A · CNAME (recomendado)"
              record={`CNAME    ${stripDot(domain.domain)}    →    ${cnameTarget}`}
              copy={cnameTarget}
            />
            <DnsRecord
              label="Opción B · TXT (alternativa)"
              record={`TXT    _csm-verify.${domain.domain}    →    ${domain.verifyToken}`}
              copy={domain.verifyToken}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            DNS tarda entre 1 minuto y unas horas en propagar. Pulsa "Verificar" cuando esté listo.
            Te avisamos en cuanto pase.
          </p>
          {domain.lastCheckError && (
            <p className="flex items-center gap-1.5 rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive">
              <AlertCircle className="size-3" />
              {domain.lastCheckError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DnsRecord({
  label,
  record,
  copy,
}: {
  label: string;
  record: string;
  copy: string;
}) {
  const [copied, setCopied] = useState(false);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-2 overflow-hidden rounded border bg-background px-2 py-1.5 font-mono text-[11px]">
        <span className="truncate">{record}</span>
        <button
          type="button"
          onClick={doCopy}
          className="ml-auto flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          aria-label="Copiar valor"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
        </button>
      </div>
    </div>
  );
}

function stripDot(domain: string): string {
  // Para CNAME, normalmente se pone solo el subdominio (sin la base) si el
  // registrador hace auto-completion. Como simplificación, mostramos la
  // forma "absoluta" — la mayoría de registradores la aceptan tal cual.
  return domain;
}

function normalizeSlugInput(v: string): string {
  return (
    v
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      // Quitar guiones inicial/final — el server los rechaza
      // (`leading_or_trailing_dash`). Para que el live-check no muestre error
      // mientras el user está escribiendo, los limpiamos en cliente.
      .replace(/^-+|-+$/g, "")
      .slice(0, 30)
  );
}
