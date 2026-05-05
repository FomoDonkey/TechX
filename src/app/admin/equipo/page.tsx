import { ComingSoonPage } from "@/components/admin/coming-soon-page";
import { Users } from "lucide-react";

export const metadata = { title: "Equipo" };

export default function EquipoPage() {
  return (
    <ComingSoonPage
      title="Equipo"
      description="Gestión de miembros del workspace, invitaciones por email, roles y permisos finos por área del CMS."
      Icon={Users}
      features={[
        "Invitar por email con magic-link de aceptación",
        "Roles: owner / admin / editor / author / viewer",
        "Permisos finos por colección, plantilla, settings",
        "Logs de acciones por miembro",
        "SCIM provisioning (plan enterprise)",
      ]}
      eta="F11"
    />
  );
}
