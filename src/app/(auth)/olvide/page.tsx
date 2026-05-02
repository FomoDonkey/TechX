import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forgot-form";
import { features } from "@/env";
import Link from "next/link";

export const metadata = { title: "Recuperar acceso" };

export default function ForgotPage() {
  return (
    <AuthShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Te enviamos un enlace mágico para volver a entrar."
      footer={
        <Link
          href="/login"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Volver al login
        </Link>
      }
    >
      <ForgotForm authReady={features.database} />
    </AuthShell>
  );
}
