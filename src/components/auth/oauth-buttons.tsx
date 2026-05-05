"use client";

import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/safe-redirect";
import { useState } from "react";
import { toast } from "sonner";

export type OAuthProviders = {
  google?: boolean;
  github?: boolean;
};

const ICONS = {
  google: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <title>Google</title>
      <path
        fill="currentColor"
        d="M22 12.21c0-.74-.07-1.45-.19-2.13H12v4.04h5.62a4.8 4.8 0 0 1-2.08 3.15v2.62h3.36c1.97-1.81 3.1-4.49 3.1-7.68z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.81 0 5.17-.93 6.9-2.51l-3.36-2.62c-.93.62-2.12.99-3.54.99-2.72 0-5.03-1.84-5.85-4.31H2.7v2.7A10 10 0 0 0 12 22z"
        opacity=".75"
      />
      <path
        fill="currentColor"
        d="M6.15 13.55a6 6 0 0 1 0-3.85V6.99H2.7a10 10 0 0 0 0 9.27l3.45-2.71z"
        opacity=".5"
      />
      <path
        fill="currentColor"
        d="M12 5.84c1.53 0 2.9.53 3.99 1.56l2.97-2.97C17.16 2.84 14.81 2 12 2A10 10 0 0 0 2.7 7l3.45 2.7c.82-2.47 3.13-4.86 5.85-4.86z"
        opacity=".25"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <title>GitHub</title>
      <path
        fill="currentColor"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-1.92c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.92 10.92 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.23 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.05.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"
      />
    </svg>
  ),
};

export function OAuthButtons({
  providers,
  callbackURL,
}: {
  providers: OAuthProviders;
  callbackURL?: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const enabled = Object.entries(providers).filter(([, v]) => v);
  if (enabled.length === 0) return null;

  async function handle(provider: "google" | "github") {
    try {
      setLoading(provider);
      // Anti open-redirect: callbackURL pasa por whitelist interna.
      const safeCb = safeInternalPath(callbackURL, "/admin");
      await authClient.signIn.social({ provider, callbackURL: safeCb });
    } catch (err) {
      toast.error(`No se pudo iniciar sesión con ${provider}`);
      console.error(err);
      setLoading(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {enabled.map(([key]) => {
        const k = key as "google" | "github";
        return (
          <Button
            key={k}
            type="button"
            variant="glass"
            size="lg"
            onClick={() => handle(k)}
            disabled={loading !== null}
            className="rounded-xl"
          >
            {ICONS[k]}
            <span className="capitalize">{k}</span>
          </Button>
        );
      })}
    </div>
  );
}
