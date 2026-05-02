"use client";

import { authClient } from "@/auth/client";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { useState } from "react";

export function UserMenu({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const [open, setOpen] = useState(false);

  async function signOut() {
    setOpen(false);
    await authClient.signOut();
    // Full reload para asegurar que cookies invalidadas se relean en el middleware
    // (evita race con guest-only redirect que reenviaría a /admin).
    window.location.href = "/login";
  }

  const initials =
    user.name
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center overflow-hidden rounded-full border border-border/60 bg-card/50 text-sm font-semibold backdrop-blur transition-colors hover:bg-muted/50"
        aria-label="Menú de usuario"
      >
        {user.image ? (
          <img src={user.image} className="size-full object-cover" alt={`Avatar de ${user.name}`} />
        ) : (
          <span className="bg-[linear-gradient(120deg,var(--brand-1),var(--brand-2))] bg-clip-text text-transparent">
            {initials}
          </span>
        )}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur">
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <UserIcon className="size-3.5" />
              Mi perfil
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <Settings className="size-3.5" />
              Ajustes
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3.5" />
              Cerrar sesión
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
