"use server";

import { resolvePreviewBranch } from "@/branches";
import { BRANCH_PREVIEW_COOKIE_MAX_AGE } from "@/branches/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Recibe el form POST de la password page. Valida + setea cookie
 * `csm_branch_preview_<token>` con el password y redirige al preview.
 * El password NUNCA viaja en URL — sólo en body POST y luego en cookie httpOnly.
 */
export async function submitPreviewPassword(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!token || !password) {
    redirect(`/preview/branch/${token}?retry=1`);
  }
  const result = await resolvePreviewBranch({ token, password });
  if ("reason" in result) {
    // password incorrecto / expirado / not-found — re-render del form
    redirect(`/preview/branch/${token}?retry=1`);
  }
  // Cookie scoped por token para que no choque entre múltiples previews abiertos.
  const store = await cookies();
  store.set(`csm_branch_preview_${token}`, password, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: BRANCH_PREVIEW_COOKIE_MAX_AGE,
    path: `/preview/branch/${token}`,
  });
  redirect(`/preview/branch/${token}`);
}
