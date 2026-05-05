import { ComingSoonPage } from "@/components/admin/coming-soon-page";
import { GitBranch } from "lucide-react";

export const metadata = { title: "Drips" };

export default function DripsPage() {
  return (
    <ComingSoonPage
      title="Drips"
      description="Secuencias automáticas de email con triggers, delays y condiciones — para onboarding, nurturing y reactivación."
      Icon={GitBranch}
      features={[
        "Editor visual de secuencias drag-and-drop",
        "Triggers: signup, abandono carrito, sin actividad 30d, etc.",
        "Branching: A/B en cada paso, condiciones por evento",
        "Plantillas pre-construidas: Welcome 7-day, Re-engagement 30-day",
      ]}
      eta="F11"
    />
  );
}
