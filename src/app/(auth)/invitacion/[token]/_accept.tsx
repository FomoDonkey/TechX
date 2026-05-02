"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo aceptar");
        setLoading(false);
        return;
      }
      toast.success("¡Te uniste al workspace!");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Error aceptando invitación");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="gradient"
      size="lg"
      className="w-full rounded-xl"
      onClick={accept}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      Aceptar y entrar
    </Button>
  );
}
