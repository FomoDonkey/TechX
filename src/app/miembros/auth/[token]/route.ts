/**
 * GET /miembros/auth/[token]
 *
 * Consume el magic link y crea sesión de miembro. Es Route Handler (no page)
 * porque Next.js 15 sólo permite escribir cookies desde Route Handlers o
 * Server Actions.
 *
 * Casos:
 *  - Token válido → setea cookie + redirige al `redirectTo` validado.
 *  - Token inválido/expirado → redirige a `/miembros?invalid_link=1`.
 */

import { db } from "@/db/client";
import { safeInternalPath } from "@/lib/safe-redirect";
import {
  consumeMagicLink,
  createMemberSession,
  currentIpHash,
  setMemberCookie,
} from "@/payments/member-auth";
import { recordMemberEvent } from "@/payments/memberships";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!db) {
    return NextResponse.redirect(new URL("/miembros?invalid_link=1", req.url), 303);
  }

  const { token } = await ctx.params;
  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    return NextResponse.redirect(new URL("/miembros?invalid_link=1", req.url), 303);
  }

  const h = await headers();
  const userAgent = h.get("user-agent")?.slice(0, 250) ?? null;
  const ipHash = await currentIpHash();

  const cookieValue = await createMemberSession({
    workspaceId: consumed.workspaceId,
    email: consumed.email,
    userAgent,
    ipHash,
  });

  await setMemberCookie(cookieValue);
  await recordMemberEvent({
    workspaceId: consumed.workspaceId,
    email: consumed.email,
    type: "session_started",
    data: { userAgent, ipHash },
  });

  const redirectTo = safeInternalPath(consumed.redirectTo, "/miembros/portal");
  return NextResponse.redirect(new URL(redirectTo, req.url), 303);
}
