import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo CSM recopila, usa y protege tus datos personales.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p>
        Esta política describe cómo CSM trata los datos personales de las personas usuarias del
        panel de administración y del sitio público generado con CSM. CSM cumple con el Reglamento
        (UE) 2016/679 (RGPD) y la LO 3/2018 de Protección de Datos.
      </p>

      <h2>Datos que recopilamos</h2>
      <ul>
        <li>
          <strong>De cuenta:</strong> email, nombre, idioma, zona horaria, avatar, identificadores
          OAuth si conectas Google/GitHub.
        </li>
        <li>
          <strong>De uso:</strong> sesiones activas (IP anonimizada y user-agent), audit log de
          acciones críticas (publicar, borrar, invitar), suscripción a memberships si aplica.
        </li>
        <li>
          <strong>De contenido:</strong> entradas, comentarios, suscripciones a newsletter,
          formularios enviados — propiedad del workspace.
        </li>
      </ul>

      <h2>Bases legales</h2>
      <ul>
        <li>Ejecución del contrato (uso del producto).</li>
        <li>Consentimiento (cookies opcionales, newsletter, marketing).</li>
        <li>Interés legítimo (seguridad, prevención de fraude).</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>Puedes ejercer en cualquier momento:</p>
      <ul>
        <li>
          <strong>Acceso y portabilidad</strong> — exporta tus datos en JSON desde{" "}
          <a href="/admin/ajustes/privacidad">Ajustes → Privacidad → Exportar mis datos</a>.
        </li>
        <li>
          <strong>Rectificación</strong> — actualiza tu perfil en{" "}
          <a href="/admin/ajustes/perfil">Ajustes → Perfil</a>.
        </li>
        <li>
          <strong>Supresión (derecho al olvido)</strong> — solicita la eliminación de tu cuenta en{" "}
          <a href="/admin/ajustes/privacidad">Ajustes → Privacidad → Eliminar cuenta</a>. Aplicamos
          un periodo de gracia de 30 días antes de borrar de forma irreversible.
        </li>
        <li>
          <strong>Oposición y limitación</strong> — escríbenos para casos específicos.
        </li>
      </ul>

      <h2>Retención</h2>
      <ul>
        <li>Sesiones: 30 días desde la última actividad.</li>
        <li>Logs A/B y analytics: 90 días en raw + agregados a perpetuidad.</li>
        <li>Backups: 30 días rotatorios.</li>
        <li>Cuentas eliminadas: borrado completo a los 30 días del soft delete.</li>
      </ul>

      <h2>Subencargados</h2>
      <p>Procesamos datos a través de los siguientes proveedores (todos con DPA RGPD-compliant):</p>
      <ul>
        <li>Vercel (hosting + CDN, EU/US — SCCs).</li>
        <li>Neon (base de datos Postgres, EU).</li>
        <li>Resend (email transaccional + newsletters, EU/US — SCCs).</li>
        <li>UploadThing / Vercel Blob (almacenamiento de medios).</li>
        <li>Stripe (pagos, si activado por el workspace).</li>
        <li>Replicate / Groq / OpenAI / Anthropic (IA generativa, opcional según workspace).</li>
      </ul>

      <h2>Contacto</h2>
      <p>
        Para ejercer tus derechos o consultas, escribe a <code>privacy@csm.dev</code> (placeholder —
        sustituir con email real al desplegar).
      </p>
    </>
  );
}
