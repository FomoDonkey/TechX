/**
 * Galería de plantillas pre-built. Devolvemos un FormSchema serializable que
 * el usuario puede importar como base. Todas en español.
 */

import type { FormSchema } from "./types";

export type FormTemplate = {
  slug: string;
  name: string;
  description: string;
  category: "contacto" | "marketing" | "encuesta" | "ventas" | "soporte";
  icon: string;
  schema: FormSchema;
};

const id = (n: string) => `f_${n}`;

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    slug: "contacto",
    name: "Contacto básico",
    description: "Nombre, email y mensaje. El clásico.",
    category: "contacto",
    icon: "📨",
    schema: {
      submitLabel: "Enviar mensaje",
      successMessage: "¡Gracias! Te respondemos en 24-48h.",
      fields: [
        {
          id: id("name"),
          key: "nombre",
          type: "text",
          label: "Nombre",
          required: true,
          placeholder: "Tu nombre",
        },
        {
          id: id("email"),
          key: "email",
          type: "email",
          label: "Email",
          required: true,
          placeholder: "tu@email.com",
        },
        {
          id: id("msg"),
          key: "mensaje",
          type: "textarea",
          label: "Mensaje",
          rows: 5,
          required: true,
          placeholder: "Cuéntanos qué necesitas",
        },
      ],
      steps: [],
    },
  },
  {
    slug: "newsletter",
    name: "Suscripción a newsletter",
    description: "Email + GDPR consent.",
    category: "marketing",
    icon: "📰",
    schema: {
      submitLabel: "Suscribirme",
      successMessage: "¡Listo! Revisa tu bandeja para confirmar.",
      fields: [
        {
          id: id("email"),
          key: "email",
          type: "email",
          label: "Tu email",
          required: true,
          placeholder: "tu@email.com",
        },
        {
          id: id("consent"),
          key: "consentimiento",
          type: "checkbox",
          label: "Acepto recibir newsletters y la política de privacidad",
          required: true,
        },
      ],
      steps: [],
    },
  },
  {
    slug: "nps",
    name: "Encuesta NPS",
    description: "Score 1-10 + comentario condicional.",
    category: "encuesta",
    icon: "📊",
    schema: {
      submitLabel: "Enviar valoración",
      successMessage: "¡Gracias por tu feedback!",
      fields: [
        {
          id: id("score"),
          key: "score",
          type: "rating",
          label: "¿Cuánto recomendarías CSM a un compañero? (1-10)",
          max: 10,
          required: true,
        },
        {
          id: id("low"),
          key: "que_falla",
          type: "textarea",
          label: "¿Qué podríamos mejorar?",
          rows: 4,
          visibleIf: { all: [{ fieldKey: "score", op: "lt", value: 7 }] },
        },
        {
          id: id("high"),
          key: "que_amaste",
          type: "textarea",
          label: "¡Cuéntanos qué te encanta!",
          rows: 4,
          visibleIf: { all: [{ fieldKey: "score", op: "gt", value: 8 }] },
        },
        {
          id: id("email"),
          key: "email",
          type: "email",
          label: "Email (opcional, para hacer seguimiento)",
        },
      ],
      steps: [],
    },
  },
  {
    slug: "demo",
    name: "Solicitud de demo",
    description: "Multi-step: empresa → necesidades → contacto.",
    category: "ventas",
    icon: "🎯",
    schema: {
      submitLabel: "Solicitar demo",
      successMessage: "¡Recibido! Te llamamos en menos de 24h.",
      fields: [
        {
          id: id("empresa"),
          key: "empresa",
          type: "text",
          label: "Empresa",
          required: true,
        },
        {
          id: id("size"),
          key: "tamano",
          type: "select",
          label: "Tamaño del equipo",
          required: true,
          options: [
            { value: "1", label: "Solo yo" },
            { value: "2-10", label: "2-10 personas" },
            { value: "11-50", label: "11-50 personas" },
            { value: "50+", label: "Más de 50" },
          ],
        },
        {
          id: id("uso"),
          key: "uso",
          type: "multiselect",
          label: "¿Para qué lo usaríais?",
          options: [
            { value: "blog", label: "Blog corporativo" },
            { value: "docs", label: "Documentación" },
            { value: "marketing", label: "Landing pages" },
            { value: "ecommerce", label: "Tienda online" },
            { value: "intranet", label: "Intranet" },
          ],
        },
        {
          id: id("nombre"),
          key: "nombre",
          type: "text",
          label: "Tu nombre",
          required: true,
        },
        {
          id: id("email"),
          key: "email",
          type: "email",
          label: "Email de trabajo",
          required: true,
        },
        {
          id: id("phone"),
          key: "telefono",
          type: "tel",
          label: "Teléfono (opcional)",
        },
      ],
      steps: [
        {
          id: "step1",
          title: "Tu empresa",
          fieldIds: [id("empresa"), id("size"), id("uso")],
        },
        {
          id: "step2",
          title: "Tu contacto",
          fieldIds: [id("nombre"), id("email"), id("phone")],
        },
      ],
    },
  },
  {
    slug: "soporte",
    name: "Ticket de soporte",
    description: "Categoría, prioridad y descripción.",
    category: "soporte",
    icon: "🛠️",
    schema: {
      submitLabel: "Enviar ticket",
      successMessage: "Ticket creado. Te avisamos por email.",
      fields: [
        {
          id: id("email"),
          key: "email",
          type: "email",
          label: "Email",
          required: true,
        },
        {
          id: id("cat"),
          key: "categoria",
          type: "select",
          label: "Categoría",
          required: true,
          options: [
            { value: "bug", label: "Bug" },
            { value: "feature", label: "Sugerencia de mejora" },
            { value: "billing", label: "Facturación" },
            { value: "other", label: "Otro" },
          ],
        },
        {
          id: id("prio"),
          key: "prioridad",
          type: "radio",
          label: "Prioridad",
          required: true,
          options: [
            { value: "low", label: "Baja" },
            { value: "med", label: "Media" },
            { value: "high", label: "Alta" },
            { value: "crit", label: "Crítica" },
          ],
          defaultValue: "med",
        },
        {
          id: id("desc"),
          key: "descripcion",
          type: "textarea",
          label: "Describe el problema",
          rows: 6,
          required: true,
          minLength: 20,
        },
        {
          id: id("attach"),
          key: "adjuntos",
          type: "file",
          label: "Adjuntos (capturas, logs)",
          multiple: true,
          accept: ["image/*", "application/pdf", "text/plain"],
        },
      ],
      steps: [],
    },
  },
];

export function getFormTemplate(slug: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.slug === slug);
}
