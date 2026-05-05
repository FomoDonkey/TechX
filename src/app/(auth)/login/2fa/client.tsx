"use client";

import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeInternalPath } from "@/lib/safe-redirect";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "totp" | "backup";

export function TwoFactorChallengeClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeInternalPath(search.get("next"), "/admin");
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code });
      const errMsg = (res as { error?: { message?: string } }).error?.message;
      if (errMsg) {
        toast.error(errMsg.includes("INVALID") ? "Código incorrecto" : errMsg);
        setLoading(false);
        return;
      }
      toast.success("¡Verificado!");
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo verificar el código");
      setLoading(false);
    }
  }

  async function submitBackup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await authClient.twoFactor.verifyBackupCode({ code: trimmed });
      const errMsg = (res as { error?: { message?: string } }).error?.message;
      if (errMsg) {
        toast.error(
          errMsg.includes("INVALID") ? "Código de recuperación inválido o ya usado" : errMsg,
        );
        setLoading(false);
        return;
      }
      toast.success("¡Verificado!", {
        description: "Recuerda regenerar códigos nuevos en Ajustes → Seguridad → 2FA.",
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo verificar el código");
      setLoading(false);
    }
  }

  if (mode === "backup") {
    return (
      <form onSubmit={submitBackup} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="backup-code" className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4" /> Código de recuperación
          </Label>
          <Input
            id="backup-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="xxxx-xxxx-xxxx"
            className="font-mono"
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            Cada código se puede usar UNA vez. Tras entrar, regenera códigos nuevos.
          </p>
        </div>
        <Button type="submit" disabled={loading || !code.trim()} className="w-full">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Verificar"}
        </Button>
        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("totp");
              setCode("");
            }}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            ← Volver al código TOTP
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitTotp} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="totp" className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" /> Código de tu app autenticadora
        </Label>
        <Input
          id="totp"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="text-center font-mono text-lg tracking-[0.5em]"
          autoFocus
          required
        />
      </div>
      <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Verificar"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("backup");
            setCode("");
          }}
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          Usar código de recuperación
        </button>
        <Link href="/login" className="text-muted-foreground underline-offset-2 hover:underline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
