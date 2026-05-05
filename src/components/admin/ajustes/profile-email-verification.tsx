"use client";

import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Renderiza estado de verificación + CTA de re-envío. La verificación real
 * la maneja Better-Auth: el link en el email apunta a `/api/auth/verify-email`
 * que marca el user como verificado y redirige.
 */
export function ProfileEmailVerification({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const [loading, setLoading] = useState(false);

  if (verified) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        <div>
          <p className="font-medium text-emerald-700 dark:text-emerald-400">Email verificado</p>
          <p className="text-xs text-muted-foreground">
            Puedes upgradear a plan de pago, recibir notificaciones críticas y solicitar tu export
            de datos sin restricciones.
          </p>
        </div>
      </div>
    );
  }

  async function handleResend() {
    if (!email) return;
    setLoading(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/admin/ajustes/perfil?verified=1",
      });
      if (result.error) {
        const status = (result.error as { status?: number }).status;
        if (status === 429) {
          toast.error("Demasiados envíos. Espera un minuto antes de volver a pedirlo.");
        } else {
          toast.error(result.error.message ?? "No se pudo enviar el email");
        }
        return;
      }
      toast.success("Email enviado", {
        description: "Revisa tu bandeja (o la consola en modo dev). Caduca en 1 hora.",
      });
    } catch (e) {
      console.error(e);
      toast.error("Error al enviar el email de verificación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-medium text-amber-700 dark:text-amber-400">Email aún no verificado</p>
          <p className="text-xs text-muted-foreground">
            Algunas acciones críticas (upgradear a plan de pago, exportar datos personales, recibir
            alertas de seguridad) requieren un email confirmado.
          </p>
        </div>
      </div>
      <Button onClick={handleResend} disabled={loading} size="sm">
        {loading ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Enviando…
          </>
        ) : (
          <>
            <Mail className="mr-1.5 size-3.5" /> Enviar email de verificación
          </>
        )}
      </Button>
    </div>
  );
}
