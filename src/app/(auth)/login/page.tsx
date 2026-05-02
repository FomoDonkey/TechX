import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { env, features } from "@/env";
import Link from "next/link";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <AuthShell
      title={
        <>
          Bienvenida de vuelta a <span className="gradient-text">CSM</span>
        </>
      }
      subtitle="Entra para escribir, diseñar y publicar."
      footer={
        <>
          ¿Sin cuenta?{" "}
          <Link
            href="/registro"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Crea tu CMS gratis →
          </Link>
        </>
      }
    >
      <LoginForm
        authReady={features.database}
        providers={{
          google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
          github: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
        }}
      />
    </AuthShell>
  );
}
