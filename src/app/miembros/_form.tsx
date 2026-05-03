"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { sendMemberMagicLinkAction } from "./_actions";

export function MagicLinkForm({
  workspaceId,
  redirectTo,
}: {
  workspaceId: string;
  redirectTo: string;
}) {
  void workspaceId;
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [csmT] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const r = await sendMemberMagicLinkAction({
        email: email.trim().toLowerCase(),
        redirectTo,
        csm_t: csmT,
        website,
      });
      if (!r.ok) {
        setStatus("error");
        setErrorMsg(
          r.error === "rate_limited"
            ? "Demasiados enlaces. Espera unos minutos."
            : r.error === "invalid_email"
              ? "Email inválido."
              : "Algo no ha ido bien. Inténtalo de nuevo.",
        );
        return;
      }
      setStatus("sent");
    });
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-center">
        <CheckCircle2 className="mx-auto size-8 text-emerald-400" />
        <p className="mt-3 font-medium">Revisa tu email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Te hemos enviado un enlace a <strong>{email}</strong>. Si no te llega en 1 min, mira la
          carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Honeypot, oculto visualmente */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <Label htmlFor="website">No rellenar</Label>
        <Input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="member-email">Email</Label>
        <Input
          id="member-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          autoComplete="email"
        />
      </div>

      {errorMsg ? <p className="text-sm text-rose-300">{errorMsg}</p> : null}

      <Button type="submit" disabled={isPending || !email.includes("@")} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Enviando…
          </>
        ) : (
          "Enviar enlace mágico"
        )}
      </Button>
    </form>
  );
}
