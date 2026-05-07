import { AuthShell } from "@/components/auth/auth-shell";
import type { Metadata } from "next";
import { TwoFactorChallengeClient } from "./client";

export const metadata: Metadata = { title: "Verificación 2FA · techx" };

export default function TwoFactorChallengePage() {
  return (
    <AuthShell
      title="Confirma que eres tú"
      subtitle="Introduce el código de tu app autenticadora o un código de recuperación."
    >
      <TwoFactorChallengeClient />
    </AuthShell>
  );
}
