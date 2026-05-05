import { listUserPasskeys } from "@/auth/passkeys";
import { getCurrentUser } from "@/auth/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasskeysClient } from "./client";

export const metadata: Metadata = { title: "Passkeys · CSM" };
export const dynamic = "force-dynamic";

export default async function PasskeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const list = await listUserPasskeys(user.id);
  return (
    <PasskeysClient
      passkeys={list.map((p) => ({
        id: p.id,
        name: p.name ?? "Passkey",
        deviceType: p.deviceType,
        backedUp: p.backedUp,
        transports: p.transports,
        createdAt: p.createdAt?.toISOString() ?? null,
      }))}
    />
  );
}
