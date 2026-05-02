import { auth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function getSession() {
  if (!auth) return null;
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireUser(redirectTo = "/login") {
  const session = await getSession();
  if (!session?.user) {
    const url = new URL(redirectTo, "http://placeholder.local");
    redirect(url.pathname + url.search);
  }
  return session.user;
}

export async function requireGuest(redirectTo = "/admin") {
  const session = await getSession();
  if (session?.user) redirect(redirectTo);
}
