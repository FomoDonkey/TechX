import { ComingSoonPage } from "@/components/admin/coming-soon-page";
import { Tag } from "lucide-react";

export const metadata = { title: "Taxonomías" };

export default function EtiquetasPage() {
  return (
    <ComingSoonPage
      title="Taxonomías y etiquetas"
      description="Sistema unificado de categorías, tags, autores y custom taxonomies por colección. Routing automático /tag/[slug] y filtros."
      Icon={Tag}
      features={[
        "Categorías + tags + autores como taxonomías nativas",
        "Custom taxonomies por colección (ej: 'países', 'tipo')",
        "Páginas auto-generadas /tag/[slug] con SEO",
        "Multi-asignación con drag&drop",
        "Merge de tags para limpiar duplicados",
      ]}
      eta="F11"
    />
  );
}
