import { auth } from "@/auth";
import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type SessionRow, SessionsClient } from "./client";

export const metadata: Metadata = { title: "Sesiones · CSM" };
export const dynamic = "force-dynamic";

export default async function SesionesPage() {
  const user = await getCurrentUser();
  if (!user || !db || !auth) redirect("/login");

  const h = await headers();
  const current = await auth.api.getSession({ headers: h });

  const rows = await db
    .select({
      id: sessions.id,
      token: sessions.token,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.updatedAt));

  const currentToken = current?.session?.token ?? null;

  const data: SessionRow[] = rows.map((r) => ({
    id: r.id,
    token: r.token,
    ipMasked: maskIp(r.ipAddress),
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    isCurrent: r.token === currentToken,
  }));

  return <SessionsClient sessions={data} />;
}

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  // IPv4: a.b.c.d → a.b.c.x
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.x`;
  // IPv6: keep first 3 groups
  const v6 = ip.split(":");
  if (v6.length >= 3) return `${v6.slice(0, 3).join(":")}::x`;
  return "•••";
}
