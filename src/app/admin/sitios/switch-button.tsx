"use client";

import { setWorkspaceCookie } from "@/components/admin/_actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SwitchToButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSwitch() {
    startTransition(async () => {
      await setWorkspaceCookie(slug);
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleSwitch}
      disabled={pending}
      className="h-8 gap-1.5 text-xs"
    >
      {pending && <Loader2 className="size-3 animate-spin" />}
      Cambiar a este
    </Button>
  );
}
