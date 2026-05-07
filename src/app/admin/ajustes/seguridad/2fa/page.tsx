import { getCurrentUser } from "@/auth/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoFactorClient } from "./client";

export const metadata: Metadata = { title: "2FA · techx" };
export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  const user = await getCurrentUser();
  if (!user || !db) redirect("/login");

  const [row] = await db
    .select({ twoFactorEnabled: users.twoFactorEnabled, email: users.email })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return <TwoFactorClient enabled={row?.twoFactorEnabled ?? false} email={row?.email ?? ""} />;
}
