import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos de uso del software CSM.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Términos y condiciones</h1>
      <p>
        CSM es software open-source. Los workspaces son responsables del contenido publicado y de
        las sub-relaciones legales con sus propias personas usuarias finales (suscriptores,
        miembros, clientes).
      </p>

      <h2>Uso aceptable</h2>
      <ul>
        <li>No publicar contenido ilegal, infractor de derechos de terceros o fraudulento.</li>
        <li>No usar la plataforma para spam masivo no consentido.</li>
        <li>Cumplir con las normativas locales aplicables (RGPD, ePrivacy, LSSI, copyright).</li>
      </ul>

      <h2>Limitación de responsabilidad</h2>
      <p>
        CSM se proporciona "tal cual", sin garantías. No nos hacemos responsables de la pérdida de
        datos cuando el operador del workspace no haya configurado backups. En despliegues
        gestionados por terceros, consulta su contrato.
      </p>

      <h2>Licencia</h2>
      <p>
        El código fuente se distribuye bajo licencia open-source (MIT — placeholder, confirmar en
        repo). El contenido publicado pertenece al workspace correspondiente.
      </p>

      <h2>Cambios</h2>
      <p>
        Podemos actualizar estos términos. Los cambios sustanciales se notifican por email a las
        cuentas activas con al menos 14 días de antelación.
      </p>
    </>
  );
}
