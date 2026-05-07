"use client";

import { authClient } from "@/auth/client";
import { OAuthButtons, type OAuthProviders } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { safeInternalPath } from "@/lib/safe-redirect";
import { startAuthentication } from "@simplewebauthn/browser";
import { motion } from "framer-motion";
import { Fingerprint, Loader2, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Mode = "password" | "magic";

export function LoginForm({
  providers,
  authReady,
}: {
  providers: OAuthProviders;
  authReady: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  // Anti open-redirect: cualquier `?next=` externa o protocol-relative cae a /admin.
  // Sin esto, atacante con `https://app/login?next=https://evil.com` redirigía
  // sesión + cookies tras login (router.push(next), Better-Auth callbackURL).
  const next = safeInternalPath(search.get("next"), "/admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("password");
  const [loading, setLoading] = useState(false);
  // Lockout por rate-limit. Si el server (Better-Auth) o nuestro endpoint de
  // passkey responden 429 con `Retry-After`, paramos los submits hasta que
  // expire. Sin esto el user puede seguir martillando el form y agravar el
  // límite con cada intento.
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!lockoutUntil) return;
    const id = setInterval(() => {
      forceTick((n) => n + 1);
      if (Date.now() >= lockoutUntil) {
        setLockoutUntil(null);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutUntil]);
  const lockedSeconds = lockoutUntil
    ? Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
    : 0;

  if (!authReady) {
    return (
      <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-medium text-warning-foreground">Auth no configurado</p>
        <p className="mt-1 text-muted-foreground">
          Define <code className="rounded bg-card px-1.5 py-0.5">DATABASE_URL</code> en{" "}
          <code className="rounded bg-card px-1.5 py-0.5">.env</code> y ejecuta{" "}
          <code className="rounded bg-card px-1.5 py-0.5">npm run db:push</code> para activar el
          login.
        </p>
      </div>
    );
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: next,
      });
      if (result.error) {
        // Better-Auth devuelve `status: 429` con `error.statusText` "Too Many
        // Requests" y header `X-Retry-After`. authClient lo normaliza a `error.status`.
        const status = (result.error as { status?: number }).status;
        if (status === 429) {
          const retryAfter = parseRetryAfter(result.error);
          setLockoutUntil(Date.now() + retryAfter * 1000);
          toast.error(`Demasiados intentos. Espera ${retryAfter}s.`);
        } else {
          toast.error(result.error.message ?? "Credenciales incorrectas");
        }
        setLoading(false);
        return;
      }
      // 2FA: si el user lo tiene activado, Better-Auth devuelve `twoFactorRedirect:true`
      // y NO finaliza la sesión. Tenemos que llevar al user a la pantalla de TOTP /
      // backup-code antes de soltarle a /admin.
      const data = result.data as { twoFactorRedirect?: boolean } | null | undefined;
      if (data?.twoFactorRedirect) {
        const url = `/login/2fa?next=${encodeURIComponent(next)}`;
        router.push(url);
        return;
      }
      toast.success("¡Bienvenida de vuelta!");
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo iniciar sesión");
      setLoading(false);
    }
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    setLoading(true);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: next,
      });
      if (result.error) {
        const status = (result.error as { status?: number }).status;
        if (status === 429) {
          const retryAfter = parseRetryAfter(result.error);
          setLockoutUntil(Date.now() + retryAfter * 1000);
          toast.error(`Demasiados envíos. Espera ${retryAfter}s.`);
        } else {
          toast.error(result.error.message ?? "No se pudo enviar el enlace");
        }
      } else {
        toast.success("Enlace enviado", {
          description: "Revisa tu email (o la consola en modo dev).",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error enviando magic link");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskey() {
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error("Tu navegador no soporta passkeys");
      return;
    }
    setLoading(true);
    try {
      const optsRes = await fetch("/api/auth/passkey/login-options", { method: "POST" });
      if (!optsRes.ok) throw new Error("No se pudo iniciar passkey");
      const opts = (await optsRes.json()) as Parameters<
        typeof startAuthentication
      >[0]["optionsJSON"];
      const assertion = await startAuthentication({ optionsJSON: opts });
      const verifyRes = await fetch("/api/auth/passkey/login-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (verifyRes.status === 429) {
        const retryAfter = Number(verifyRes.headers.get("retry-after") ?? "60");
        setLockoutUntil(Date.now() + retryAfter * 1000);
        toast.error(`Demasiados intentos de passkey. Espera ${retryAfter}s.`);
        return;
      }
      const data = (await verifyRes.json()) as { ok?: boolean; error?: string };
      if (!verifyRes.ok || !data.ok) {
        throw new Error(data.error ?? "passkey_failed");
      }
      toast.success("¡Bienvenida de vuelta!");
      router.push(next);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de passkey";
      // Cancelaciones del user son benignas, no las pintamos como error.
      if (msg.includes("cancel") || msg.toLowerCase().includes("notallow")) {
        // silencioso
      } else if (msg === "challenge_expired") {
        toast.error("La passkey caducó. Vuelve a intentarlo.");
      } else if (msg === "unknown_credential") {
        toast.error("Esta passkey no está registrada.");
      } else {
        toast.error("No se pudo entrar con passkey");
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {lockoutUntil && lockedSeconds > 0 ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-sm">
          <p className="font-medium text-destructive">Cuenta bloqueada temporalmente</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Demasiados intentos. Vuelve a intentarlo en{" "}
            <span className="font-mono font-semibold text-foreground">{lockedSeconds}s</span>.
          </p>
        </div>
      ) : null}

      <OAuthButtons providers={providers} callbackURL={next} />

      {(providers.google || providers.github) && (
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
            o con email
          </span>
        </div>
      )}

      <motion.form
        key={mode}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onSubmit={mode === "password" ? handlePassword : handleMagic}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        {mode === "password" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link href="/olvide" className="text-xs text-muted-foreground hover:text-foreground">
                ¿Olvidaste?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        ) : null}

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="w-full rounded-xl"
          disabled={loading || lockedSeconds > 0}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : mode === "password" ? (
            <>
              <Sparkles className="size-4" /> Entrar
            </>
          ) : (
            <>
              <Mail className="size-4" /> Enviar enlace mágico
            </>
          )}
        </Button>
      </motion.form>

      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode(mode === "password" ? "magic" : "password")}
          className="text-muted-foreground hover:text-foreground"
        >
          {mode === "password" ? "Usar enlace mágico" : "Usar contraseña"}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handlePasskey}
          disabled={loading || lockedSeconds > 0}
        >
          <Fingerprint className="size-4" />
          Iniciar con passkey
        </Button>
      </div>
    </div>
  );
}

/**
 * Better-Auth client devuelve un objeto error sin tipo común; intentamos
 * extraer un retry-after en segundos. Si no lo encontramos, asumimos 60s
 * (alineado con `auth.rateLimit.window`).
 */
function parseRetryAfter(err: unknown): number {
  const e = err as { headers?: Headers; statusText?: string; details?: unknown };
  const ra = e?.headers?.get?.("retry-after");
  const n = ra ? Number(ra) : Number.NaN;
  if (Number.isFinite(n) && n > 0) return Math.min(n, 600);
  return 60;
}
