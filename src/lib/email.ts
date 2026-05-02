import { env, features } from "@/env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
};

export type SendEmailResult = {
  ok: boolean;
  id?: string;
  previewUrl?: string;
  mocked?: boolean;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!features.email) {
    console.log("\n📨 [email mock] →", input.to);
    console.log("   subject:", input.subject);
    console.log("   ", input.text ?? input.html.replace(/<[^>]+>/g, "").slice(0, 280));
    console.log();
    return { ok: true, mocked: true };
  }

  const from = input.from ?? env.RESEND_FROM;
  if (!from || !from.includes("@")) {
    console.error(
      "Resend: RESEND_FROM no configurado o inválido (esperado 'Nombre <correo@dominio>').",
    );
    return { ok: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error", res.status, body);
      return { ok: false };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("Resend fetch failed", err);
    return { ok: false };
  }
}

export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }) {
  const subject = "Tu enlace para entrar a CSM";
  const html = `
<!doctype html>
<html><body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#0c0a14;color:#fff;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:linear-gradient(160deg,#1a1228,#0c0a14);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:32px;">
    <div style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#c08bff;margin-bottom:8px;">CSM</div>
    <h1 style="font-size:22px;margin:0 0 12px;">Tu enlace mágico está listo ✨</h1>
    <p style="color:#b8b3c7;line-height:1.6;margin:0 0 24px;">
      Haz click en el botón para entrar a CSM. Este enlace caduca en 10 minutos y solo se puede usar una vez.
    </p>
    <a href="${url}" style="display:inline-block;background:linear-gradient(120deg,#9b5cff,#ff5db1);color:#fff;text-decoration:none;padding:14px 24px;border-radius:14px;font-weight:600;">Entrar a CSM →</a>
    <p style="color:#736e83;font-size:12px;margin-top:32px;">Si no pediste este email, ignóralo.</p>
  </div>
</body></html>`;
  const result = await sendEmail({
    to,
    subject,
    html,
    text: `Entra a CSM: ${url}\n\nEste enlace caduca en 10 minutos.`,
  });
  if (result.mocked) {
    console.log("🔗 magic link →", url, "\n");
  }
  return result;
}

export async function sendInvitationEmail({
  to,
  inviterName,
  workspaceName,
  url,
}: {
  to: string;
  inviterName: string;
  workspaceName: string;
  url: string;
}) {
  const subject = `${inviterName} te invita a ${workspaceName} en CSM`;
  const html = `
<!doctype html>
<html><body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#0c0a14;color:#fff;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:linear-gradient(160deg,#1a1228,#0c0a14);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:32px;">
    <div style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#c08bff;margin-bottom:8px;">CSM · Invitación</div>
    <h1 style="font-size:22px;margin:0 0 12px;">${inviterName} te invita a unirte a <span style="color:#ff5db1;">${workspaceName}</span></h1>
    <p style="color:#b8b3c7;line-height:1.6;margin:0 0 24px;">
      Tendrás acceso para colaborar en contenido, medios y publicación.
    </p>
    <a href="${url}" style="display:inline-block;background:linear-gradient(120deg,#9b5cff,#ff5db1);color:#fff;text-decoration:none;padding:14px 24px;border-radius:14px;font-weight:600;">Aceptar invitación →</a>
    <p style="color:#736e83;font-size:12px;margin-top:32px;">Esta invitación caduca en 7 días.</p>
  </div>
</body></html>`;
  return sendEmail({ to, subject, html });
}
