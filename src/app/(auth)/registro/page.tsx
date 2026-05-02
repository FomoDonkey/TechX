import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { env, features } from "@/env";
import Link from "next/link";

export const metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <AuthShell
      title={
        <>
          Crea tu CMS <span className="gradient-text">en 60 segundos</span>
        </>
      }
      subtitle="Sin tarjeta, sin instalación. Te lleva al onboarding mágico al final."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Iniciar sesión →
          </Link>
        </>
      }
    >
      <RegisterForm
        authReady={features.database}
        providers={{
          google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
          github: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
        }}
      />
    </AuthShell>
  );
}
