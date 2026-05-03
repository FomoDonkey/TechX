"use server";

import { db } from "@/db/client";
import { workspaces } from "@/db/schema";
import { sendMemberMagicLinkEmail } from "@/lib/email";
import {
  MEMBER_COOKIE,
  clearMemberCookie,
  createMagicLink,
  currentIpHash,
  getCurrentMemberSession,
  revokeMemberSessionByCookie,
} from "@/payments/member-auth";
import { recordMemberEvent } from "@/payments/memberships";
import { publicOrigin } from "@/payments/public-workspace";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const HONEYPOT_FIELD = "website";
const MIN_FORM_TIME_MS = 800;

async function resolveWorkspaceForRequest() {
  if (!db) return null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  // Resolución por host
  const { resolveWorkspaceIdByHost } = await import("@/redirects/runtime");
  const id = host ? await resolveWorkspaceIdByHost(host) : null;
  if (id) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (ws) return ws;
  }
  // Fallback: primer workspace
  const [first] = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1);
  return first ?? null;
}

const SendMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  redirectTo: z.string().max(500).optional(),
  csm_t: z.coerce.number().optional(),
  [HONEYPOT_FIELD]: z.string().optional(),
});

export async function sendMemberMagicLinkAction(input: unknown) {
  const parsed = SendMagicLinkSchema.safeParse(input);
  // Honeypot — silencioso
  if (parsed.success && parsed.data[HONEYPOT_FIELD]?.trim()) {
    return { ok: true as const, sent: true };
  }
  // Time-trap
  if (parsed.success && parsed.data.csm_t && Date.now() - parsed.data.csm_t < MIN_FORM_TIME_MS) {
    return { ok: true as const, sent: true };
  }
  if (!parsed.success) return { ok: false as const, error: "invalid_email" };

  const ws = await resolveWorkspaceForRequest();
  if (!ws) return { ok: false as const, error: "workspace_unresolved" };

  const ipHash = await currentIpHash();
  const result = await createMagicLink({
    workspaceId: ws.id,
    email: parsed.data.email,
    redirectTo: parsed.data.redirectTo ?? "/miembros/portal",
    ipHash,
  });

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return { ok: false as const, error: "rate_limited" };
    }
    return { ok: false as const, error: result.reason };
  }

  const origin = publicOrigin(ws);
  const url = `${origin}/miembros/auth/${result.token}`;

  await sendMemberMagicLinkEmail({
    to: parsed.data.email,
    workspaceName: ws.name,
    url,
  });

  await recordMemberEvent({
    workspaceId: ws.id,
    email: parsed.data.email,
    type: "magic_link_sent",
    data: { ipHash },
  });

  return { ok: true as const, sent: true };
}

export async function logoutMemberAction() {
  const jar = await cookies();
  const value = jar.get(MEMBER_COOKIE)?.value;

  // Capture session info before revoke for audit log
  const ws = await resolveWorkspaceForRequest();
  if (ws) {
    const session = await getCurrentMemberSession(ws.id);
    if (session) {
      await recordMemberEvent({
        workspaceId: ws.id,
        email: session.email,
        type: "session_ended",
      });
    }
  }

  if (value) {
    await revokeMemberSessionByCookie(value);
  }
  await clearMemberCookie();
  redirect("/miembros?logged_out=1");
}
