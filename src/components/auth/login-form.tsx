"use client";

import { authClient } from "@/auth/client";
import { OAuthButtons, type OAuthProviders } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { Fingerprint, Loader2, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
  const next = search.get("next") || "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("password");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: next,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Credenciales incorrectas");
        setLoading(false);
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
    setLoading(true);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: next,
      });
      if (result.error) {
        toast.error(result.error.message ?? "No se pudo enviar el enlace");
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

  function handlePasskey() {
    toast.info("Passkeys próximamente", {
      description: "Llegan en cuanto upgrademos better-auth a la versión con plugin passkey.",
    });
  }

  return (
    <div className="space-y-5">
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
          disabled={loading}
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
          disabled={loading}
        >
          <Fingerprint className="size-4" />
          Passkey
        </Button>
      </div>
    </div>
  );
}
