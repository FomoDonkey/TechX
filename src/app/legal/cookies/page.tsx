import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Tipos de cookies que usamos y cómo gestionar tu consentimiento.",
};

export default function CookiesPolicyPage() {
  return (
    <>
      <h1>Política de cookies</h1>
      <p>
        En CSM usamos cookies para que la aplicación funcione, recordar tus preferencias y, si
        aceptas, para entender cómo se usa el producto. Esta página describe qué cookies usamos y
        cómo cambiar tu decisión en cualquier momento.
      </p>

      <h2>Cookies necesarias</h2>
      <ul>
        <li>
          <strong>csm.session_token</strong> — sesión iniciada (Better-Auth, HttpOnly).
        </li>
        <li>
          <strong>csm_aid</strong> — identificador anónimo (1 año) para experimentos A/B y métricas
          agregadas. No se vincula a tu identidad real.
        </li>
        <li>
          <strong>csm_ws</strong> — workspace activo en el panel de admin.
        </li>
        <li>
          <strong>csm_branch</strong> — branch de contenido activa en /admin (no se envía al sitio
          público).
        </li>
        <li>
          <strong>csm_consent</strong> — almacena tu propia decisión sobre cookies.
        </li>
      </ul>

      <h2>Cookies opcionales</h2>
      <ul>
        <li>
          <strong>Analítica</strong> — métricas de rendimiento (LCP, CLS, INP) y errores
          anonimizados para mejorar el producto.
        </li>
        <li>
          <strong>Marketing</strong> — atribución de campañas y conversiones. Off por defecto.
        </li>
      </ul>

      <h2>Cambiar tu decisión</h2>
      <p>
        Puedes cambiar tu consentimiento en cualquier momento desde{" "}
        <a href="/admin/ajustes/privacidad">Ajustes → Privacidad</a> o borrando la cookie
        <code>csm_consent</code> en tu navegador para volver a ver el banner.
      </p>

      <h2>Tu privacidad</h2>
      <p>
        Para más detalles sobre datos personales, consulta nuestra{" "}
        <a href="/legal/privacidad">política de privacidad</a>.
      </p>
    </>
  );
}
