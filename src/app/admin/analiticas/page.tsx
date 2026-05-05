import { ComingSoonPage } from "@/components/admin/coming-soon-page";
import { BarChart3 } from "lucide-react";

export const metadata = { title: "Analíticas" };

export default function AnaliticasPage() {
  return (
    <ComingSoonPage
      title="Analíticas"
      description="Dashboard nativo sin tracking de terceros. Pageviews, sources, conversion funnels, retención de suscriptores y eventos personalizados — todo on-premise."
      Icon={BarChart3}
      features={[
        "Pageviews + sources sin cookies (privacy-first)",
        "Funnels custom por path o evento",
        "Retención de suscriptores y miembros (cohorts)",
        "Real-time visitors counter",
        "Export CSV/JSON",
      ]}
      eta="F11"
    />
  );
}
