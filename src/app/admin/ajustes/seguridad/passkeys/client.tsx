"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startRegistration } from "@simplewebauthn/browser";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Cloud, Fingerprint, Pencil, ShieldOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type PasskeyRow = {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  createdAt: string | null;
};

export function PasskeysClient({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [_, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";

  async function handleAdd() {
    setBusy(true);
    setErr(null);
    try {
      const optsRes = await fetch("/api/admin/passkeys/register-options", { method: "POST" });
      if (!optsRes.ok) throw new Error("No se pudo iniciar el registro");
      const opts = (await optsRes.json()) as Parameters<typeof startRegistration>[0]["optionsJSON"];

      const attestation = await startRegistration({ optionsJSON: opts });

      const verifyRes = await fetch("/api/admin/passkeys/register-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation, name }),
      });
      const data = (await verifyRes.json()) as { verified?: boolean; error?: string };
      if (!verifyRes.ok || !data.verified) {
        throw new Error(data.error ?? "No se pudo verificar la passkey");
      }
      setAdding(false);
      setName("");
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      // Cancelaciones de usuario son benignas
      if (msg.includes("cancel") || msg.toLowerCase().includes("notallow")) {
        setErr("Se canceló el registro de la passkey.");
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta passkey? No podrás iniciar sesión con ella.")) return;
    const res = await fetch(`/api/admin/passkeys/${id}`, { method: "DELETE" });
    if (res.ok) startTransition(() => router.refresh());
  }

  async function handleRename(id: string, newName: string) {
    if (!newName.trim()) return;
    const res = await fetch(`/api/admin/passkeys/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setEditingId(null);
      startTransition(() => router.refresh());
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Passkeys</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Inicia sesión sin contraseña usando huella, Face ID, Windows Hello o una llave de
            seguridad física (YubiKey, Titan).
          </p>
        </div>
        {supported ? (
          <Button onClick={() => setAdding(true)} disabled={adding}>
            <Fingerprint className="mr-1.5 size-4" /> Añadir passkey
          </Button>
        ) : null}
      </header>

      {!supported ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
          Tu navegador no soporta WebAuthn. Prueba con Chrome, Safari, Firefox o Edge actualizados.
        </div>
      ) : null}

      {adding ? (
        <div className="space-y-3 rounded-xl border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="pk-name">Nombre (opcional)</Label>
            <Input
              id="pk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MacBook personal"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Un nombre descriptivo te ayuda a identificar dónde está cada passkey.
            </p>
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={busy}>
              {busy ? "Creando…" : "Crear passkey"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setName("");
                setErr(null);
              }}
              disabled={busy}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {passkeys.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card/30 px-6 py-10 text-center">
          <ShieldOff className="size-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Aún no tienes passkeys</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Las passkeys son resistentes a phishing y más cómodas que las contraseñas. Añade al
            menos una.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Fingerprint className="size-5" />
                </div>
                <div className="min-w-0">
                  {editingId === p.id ? (
                    <RenameInline
                      initial={p.name}
                      onCancel={() => setEditingId(null)}
                      onSave={(v) => handleRename(p.id, v)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => setEditingId(p.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Renombrar"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {p.deviceType === "multiDevice"
                      ? "Multi-dispositivo"
                      : "Vinculada a este dispositivo"}
                    {p.backedUp ? (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Cloud className="size-3" /> Sincronizada
                      </span>
                    ) : null}
                  </p>
                  {p.createdAt ? (
                    <p className="text-xs text-muted-foreground">
                      Creada{" "}
                      {formatDistanceToNow(new Date(p.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(p.id)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1.5 size-3.5" /> Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="text-sm">
        <Link
          href="/admin/ajustes/seguridad"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Volver a Seguridad
        </Link>
      </div>
    </>
  );
}

function RenameInline({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
      className="flex items-center gap-2"
    >
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        maxLength={80}
        className="h-8"
        autoFocus
      />
      <Button type="submit" size="sm">
        Guardar
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
    </form>
  );
}
