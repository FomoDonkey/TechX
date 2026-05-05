"use client";

import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

type Step = "intro" | "verify" | "done";

export function TwoFactorClient({ enabled, email }: { enabled: boolean; email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await authClient.twoFactor.enable({
        password,
        issuer: `CSM (${email})`,
      });
      const data = (res as { data?: { totpURI?: string; backupCodes?: string[] } }).data;
      if (!data?.totpURI || !data.backupCodes) {
        const errMsg = (res as { error?: { message?: string } }).error?.message;
        setErr(errMsg ?? "No se pudo activar 2FA. Revisa tu contraseña.");
        return;
      }
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes);
      setStep("verify");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code });
      const errMsg = (res as { error?: { message?: string } }).error?.message;
      if (errMsg) {
        setErr("Código incorrecto. Inténtalo de nuevo.");
        return;
      }
      setStep("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("¿Desactivar 2FA? Tu cuenta quedará menos protegida.")) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await authClient.twoFactor.disable({ password });
      const errMsg = (res as { error?: { message?: string } }).error?.message;
      if (errMsg) {
        setErr(errMsg);
        return;
      }
      router.refresh();
      router.push("/admin/ajustes/seguridad");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  if (enabled) {
    return (
      <>
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">2FA activado</h1>
              <p className="text-sm text-muted-foreground">
                Tu cuenta requiere un código TOTP en cada inicio de sesión.
              </p>
            </div>
          </div>
        </header>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-base font-semibold">Desactivar 2FA</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirma tu contraseña para desactivar la verificación en dos pasos.
          </p>
          <form onSubmit={handleDisable} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw-disable">Contraseña</Label>
              <Input
                id="pw-disable"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <Button type="submit" variant="destructive" disabled={busy || !password}>
              {busy ? "Desactivando…" : "Desactivar 2FA"}
            </Button>
          </form>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-base font-semibold">Códigos de recuperación</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Genera 10 códigos nuevos (los anteriores quedarán inválidos). Úsalos si pierdes acceso a
            tu app autenticadora.
          </p>
          <div className="mt-4">
            <RegenerateBackupCodes />
          </div>
        </div>

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

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Activar 2FA</h1>
        <p className="text-sm text-muted-foreground">
          Añade un segundo factor con tu app autenticadora favorita (Google Authenticator,
          1Password, Bitwarden, Authy…).
        </p>
      </header>

      <Stepper step={step} />

      {step === "intro" ? (
        <form onSubmit={handleEnable} className="space-y-5 rounded-xl border bg-card p-6">
          <div className="space-y-1.5">
            <Label htmlFor="pw-enable">Confirma tu contraseña</Label>
            <Input
              id="pw-enable"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground">
              Necesitamos verificar que eres tú antes de activar 2FA.
            </p>
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !password}>
              {busy ? "Generando…" : "Continuar"}
            </Button>
            <Button asChild type="button" variant="ghost">
              <Link href="/admin/ajustes/seguridad">Cancelar</Link>
            </Button>
          </div>
        </form>
      ) : null}

      {step === "verify" && totpURI ? (
        <div className="space-y-6">
          <div className="grid gap-6 rounded-xl border bg-card p-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={totpURI} size={180} level="M" />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Escanea con tu app autenticadora
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">1. Escanea el código</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Si no puedes escanear, copia esta clave manualmente:
                </p>
                <ManualKeyDisplay uri={totpURI} />
              </div>
              <div>
                <h3 className="text-base font-semibold">2. Guarda tus códigos de recuperación</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada código sirve <strong>una sola vez</strong>. Guárdalos en un sitio seguro.
                </p>
                <BackupCodesPanel codes={backupCodes} />
              </div>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4 rounded-xl border bg-card p-6">
            <div className="space-y-1.5">
              <Label htmlFor="totp-code">3. Introduce el código de tu app</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="font-mono text-lg tracking-[0.4em]"
                autoFocus
                required
              />
            </div>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? "Verificando…" : "Activar 2FA"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("intro")}>
                Atrás
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">¡2FA activado!</h2>
              <p className="text-sm text-muted-foreground">
                A partir de ahora se te pedirá un código en cada inicio de sesión.
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              router.refresh();
              router.push("/admin/ajustes/seguridad");
            }}
          >
            Volver a Seguridad
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { id: "intro", label: "Confirmar" },
    { id: "verify", label: "Verificar" },
    { id: "done", label: "Listo" },
  ] as const;
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={`grid size-6 place-items-center rounded-full font-mono text-[11px] ${
              i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === idx ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
          {i < steps.length - 1 ? <span className="mx-1 text-muted-foreground">→</span> : null}
        </li>
      ))}
    </ol>
  );
}

function ManualKeyDisplay({ uri }: { uri: string }) {
  const secret = (() => {
    try {
      const u = new URL(uri);
      return u.searchParams.get("secret") ?? "";
    } catch {
      return "";
    }
  })();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border bg-muted/50 px-2 py-1.5 font-mono text-xs">
        {secret || uri}
      </code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(secret || uri);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

function BackupCodesPanel({ codes }: { codes: string[] }) {
  function download() {
    const txt = [
      "# CSM — códigos de recuperación 2FA",
      "# Cada código sirve UNA sola vez.",
      "",
      ...codes,
    ].join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csm-2fa-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function copyAll() {
    navigator.clipboard.writeText(codes.join("\n"));
  }
  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-1.5 rounded-md border bg-muted/30 p-3 font-mono text-xs sm:grid-cols-2">
        {codes.map((c) => (
          <span key={c} className="select-all">
            {c}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={download}>
          <Download className="mr-1.5 size-3.5" /> Descargar .txt
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={copyAll}>
          <Copy className="mr-1.5 size-3.5" /> Copiar
        </Button>
      </div>
    </div>
  );
}

function RegenerateBackupCodes() {
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await authClient.twoFactor.generateBackupCodes({ password: pw });
      const data = (res as { data?: { backupCodes?: string[] } }).data;
      const errMsg = (res as { error?: { message?: string } }).error?.message;
      if (!data?.backupCodes) {
        setErr(errMsg ?? "No se pudieron generar nuevos códigos.");
        return;
      }
      setCodes(data.backupCodes);
      setPw("");
    } finally {
      setBusy(false);
    }
  }

  if (codes) return <BackupCodesPanel codes={codes} />;

  return (
    <form onSubmit={handle} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pw-regen">Contraseña</Label>
        <Input
          id="pw-regen"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" size="sm" variant="secondary" disabled={busy || !pw}>
        {busy ? "Generando…" : "Generar nuevos códigos"}
      </Button>
    </form>
  );
}
