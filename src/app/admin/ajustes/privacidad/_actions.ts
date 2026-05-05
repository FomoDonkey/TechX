"use server";

import { auth } from "@/auth";
import { requireUser } from "@/auth/server";
import { cancelDeletion, requestDeletion } from "@/privacy/lib";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Solicita eliminación de cuenta. Setea `deletionRequestedAt = now()` →
 * el cron diario lo elimina cuando pase el grace period (30 días).
 * No cierra sesión: el user puede cancelar mientras esté logueado.
 */
export async function requestDeletionAction() {
  const user = await requireUser();
  await requestDeletion(user.id);
  revalidatePath("/admin/ajustes/privacidad");
}

/**
 * Cancela la solicitud de eliminación si aún está dentro del grace period.
 */
export async function cancelDeletionAction() {
  const user = await requireUser();
  await cancelDeletion(user.id);
  revalidatePath("/admin/ajustes/privacidad");
}

/**
 * Cierra todas las sesiones activas del user (incluida la actual). Tras
 * llamar esto el cliente debe redirigir a /login.
 */
export async function closeAllSessionsAction() {
  const user = await requireUser();
  if (!auth) throw new Error("auth_unavailable");
  const h = await headers();
  await auth.api.revokeSessions({ headers: h });
  void user;
  redirect("/login");
}
