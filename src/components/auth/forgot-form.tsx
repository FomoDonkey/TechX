"use client";

import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ForgotForm({ authReady }: { authReady: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (!authReady) {
    return (
      <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
        Auth no configurado.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/admin",
      });
      if (result.error) {
        toast.error(result.error.message ?? "No se pudo enviar el enlace");
      } else {
        setSent(true);
        toast.success("Enlace enviado", {
          description: "Revisa tu email (o la consola en modo dev).",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error enviando el enlace");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/10 p-5 text-center text-sm">
        <Mail className="mx-auto mb-2 size-6 text-success" />
        <p className="font-medium">Revisa tu bandeja</p>
        <p className="mt-1 text-muted-foreground">
          Te enviamos un enlace a <span className="text-foreground">{email}</span>. Caduca en 10
          minutos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email de tu cuenta</Label>
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
            <Mail className="size-4" />
            Enviar enlace mágico
          </>
        )}
      </Button>
    </form>
  );
}
