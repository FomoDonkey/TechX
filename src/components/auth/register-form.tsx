"use client";

import { authClient } from "@/auth/client";
import { OAuthButtons, type OAuthProviders } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function RegisterForm({
  providers,
  authReady,
}: {
  providers: OAuthProviders;
  authReady: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authReady) {
    return (
      <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-medium text-warning-foreground">Auth no configurado</p>
        <p className="mt-1 text-muted-foreground">
          Conecta una base de datos en <code>.env</code> y vuelve.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: "/onboarding",
      });
      if (result.error) {
        toast.error(result.error.message ?? "No se pudo crear la cuenta");
        setLoading(false);
        return;
      }
      toast.success("¡Cuenta creada! Vamos al onboarding.");
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <OAuthButtons providers={providers} callbackURL="/onboarding" />

      {(providers.google || providers.github) && (
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
            o con email
          </span>
        </div>
      )}

      <motion.form
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Tu nombre</Label>
          <Input
            id="name"
            required
            minLength={2}
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>
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
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="w-full rounded-xl"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="size-4" />
              Crear mi CMS
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Al registrarte aceptas los{" "}
          <Link href="/terminos" className="underline hover:text-foreground">
            términos
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline hover:text-foreground">
            política de privacidad
          </Link>
          .
        </p>
      </motion.form>
    </div>
  );
}
