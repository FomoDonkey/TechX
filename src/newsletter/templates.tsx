/**
 * Plantillas de email handcrafted como string templates. Evitamos
 * `react-dom/server` (Next bloquea su import en App Router) y mantenemos
 * la API tipada. Reglas:
 *  - Inline styles obligatorios (clientes de email no leen <style>/CSS externo).
 *  - Tablas para layout (Outlook).
 *  - Max-width 600px columna única.
 *  - Hex sólidos (no oklch).
 *  - Imágenes con width/height fijas.
 */

import "server-only";

const colors = {
  bg: "#0c0a14",
  card: "#15101f",
  border: "rgba(255,255,255,0.08)",
  fg: "#ffffff",
  muted: "#b8b3c7",
  subtle: "#736e83",
  brand1: "#9b5cff",
  brand2: "#ff5db1",
  link: "#c08bff",
};

const fontStack = "Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const DOCTYPE = "<!doctype html>\n";

// ============================================================
// Shell común
// ============================================================
function shell({
  preheader,
  workspaceName,
  body,
  unsubscribeUrl,
  preferencesUrl,
}: {
  preheader?: string;
  workspaceName: string;
  body: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}): string {
  const wsName = escapeText(workspaceName);
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${colors.bg}">${escapeText(preheader)}</div>`
    : "";

  const footerLinks = [
    preferencesUrl
      ? `<a href="${escapeAttr(preferencesUrl)}" style="color:${colors.subtle}">Gestionar preferencias</a>`
      : "",
    unsubscribeUrl
      ? `<a href="${escapeAttr(unsubscribeUrl)}" style="color:${colors.subtle}">Cancelar suscripción</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const footerNote = `Recibes este email porque te suscribiste a ${wsName}.`;

  return `${DOCTYPE}<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${wsName}</title></head>
<body style="margin:0;padding:0;background:${colors.bg};color:${colors.fg};font-family:${fontStack};-webkit-font-smoothing:antialiased;">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${colors.bg};padding:32px 16px;">
<tbody><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:linear-gradient(165deg,#1a1228 0%,${colors.bg} 100%);border:1px solid ${colors.border};border-radius:24px;overflow:hidden;">
<tbody>
<tr><td style="padding:32px 32px 8px;">
<div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${colors.link};font-weight:600;">${wsName}</div>
</td></tr>
<tr><td style="padding:8px 32px 32px;color:${colors.fg};font-size:16px;line-height:1.6;">
${body}
</td></tr>
</tbody>
</table>
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;margin-top:16px;">
<tbody><tr><td align="center" style="color:${colors.subtle};font-size:11px;padding:16px 32px;line-height:1.6;">
${footerLinks}${footerLinks ? "<br/>" : ""}${escapeText(footerNote)}
</td></tr></tbody>
</table>
</td></tr></tbody>
</table>
</body></html>`;
}

function heading(text: string): string {
  return `<h1 style="font-size:26px;margin:0 0 16px;line-height:1.25;font-weight:700;">${escapeText(text)}</h1>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;color:${colors.muted};">${html}</p>`;
}

function button(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0 24px;">
<tbody><tr><td style="background:linear-gradient(120deg,${colors.brand1},${colors.brand2});border-radius:14px;">
<a href="${escapeAttr(href)}" style="display:inline-block;padding:14px 28px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;">${escapeText(label)}</a>
</td></tr></tbody></table>`;
}

function helper(html: string): string {
  return `<p style="margin:24px 0 0;color:${colors.subtle};font-size:13px;">${html}</p>`;
}

function trackingPixel(url?: string): string {
  if (!url) return "";
  return `<img src="${escapeAttr(url)}" alt="" width="1" height="1" style="display:block;border:0;opacity:0;" />`;
}

// ============================================================
// Confirmation
// ============================================================
export type ConfirmationProps = {
  workspaceName: string;
  subscriberEmail: string;
  confirmUrl: string;
};

export function renderConfirmation(props: ConfirmationProps): string {
  const wsName = escapeText(props.workspaceName);
  const email = escapeText(props.subscriberEmail);
  const body = [
    heading("Confirma tu suscripción ✦"),
    paragraph(
      `Casi listo. Para empezar a recibir <strong>${wsName}</strong> en <strong>${email}</strong>, sólo necesitas confirmar tu email haciendo click en el botón.`,
    ),
    button(props.confirmUrl, "Confirmar suscripción →"),
    paragraph("Este enlace caduca en 7 días. Si no pediste suscribirte puedes ignorar este email."),
    helper(
      `¿El botón no funciona? Copia y pega esta dirección en tu navegador:<br/><span style="color:${colors.link};word-break:break-all;">${escapeText(props.confirmUrl)}</span>`,
    ),
  ].join("\n");
  return shell({
    preheader: "Confirma tu suscripción para empezar a recibir nuestros envíos.",
    workspaceName: props.workspaceName,
    body,
  });
}

// ============================================================
// Welcome
// ============================================================
export type WelcomeProps = {
  workspaceName: string;
  subscriberName?: string | null;
  homeUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
};

export function renderWelcome(props: WelcomeProps): string {
  const greeting = props.subscriberName ? `, ${escapeText(props.subscriberName)}` : "";
  const wsName = escapeText(props.workspaceName);
  const body = [
    heading(`Bienvenido${greeting} 🎉`),
    paragraph(
      "Estás dentro. A partir de ahora recibirás nuestras nuevas publicaciones directamente en tu bandeja de entrada. Sin spam, sólo lo que merece la pena.",
    ),
    button(props.homeUrl, `Explorar ${wsName} →`),
    paragraph("Gracias por estar aquí. Nos leemos pronto."),
  ].join("\n");
  return shell({
    preheader: `Bienvenido a ${props.workspaceName}.`,
    workspaceName: props.workspaceName,
    body,
    preferencesUrl: props.preferencesUrl,
    unsubscribeUrl: props.unsubscribeUrl,
  });
}

// ============================================================
// Broadcast
// ============================================================
export type BroadcastProps = {
  workspaceName: string;
  subject: string;
  bodyHtml: string;
  preheader?: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  trackingPixel?: string;
};

export function renderBroadcast(props: BroadcastProps): string {
  // bodyHtml ya viene sanitizado/compilado por compose.ts
  const body = `${props.bodyHtml}\n${trackingPixel(props.trackingPixel)}`;
  return shell({
    preheader: props.preheader ?? props.subject,
    workspaceName: props.workspaceName,
    body,
    preferencesUrl: props.preferencesUrl,
    unsubscribeUrl: props.unsubscribeUrl,
  });
}

// ============================================================
// Drip step
// ============================================================
export type DripStepProps = {
  workspaceName: string;
  subject: string;
  bodyHtml: string;
  stepNumber: number;
  totalSteps: number;
  preferencesUrl: string;
  unsubscribeUrl: string;
  trackingPixel?: string;
};

export function renderDripStep(props: DripStepProps): string {
  const tag = `<div style="color:${colors.subtle};font-size:11px;text-transform:uppercase;letter-spacing:0.16em;margin-bottom:12px;">Paso ${props.stepNumber} / ${props.totalSteps}</div>`;
  const body = `${tag}${props.bodyHtml}\n${trackingPixel(props.trackingPixel)}`;
  return shell({
    preheader: `Paso ${props.stepNumber} de ${props.totalSteps}: ${props.subject}`,
    workspaceName: props.workspaceName,
    body,
    preferencesUrl: props.preferencesUrl,
    unsubscribeUrl: props.unsubscribeUrl,
  });
}

export const builtinTemplates = {
  confirmation: { slug: "confirmation", name: "Confirmación de suscripción" },
  welcome: { slug: "welcome", name: "Bienvenida" },
  broadcast: { slug: "broadcast", name: "Newsletter genérica" },
  dripStep: { slug: "drip-step", name: "Paso de secuencia (drip)" },
} as const;
