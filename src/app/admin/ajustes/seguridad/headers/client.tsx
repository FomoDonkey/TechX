"use client";

import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { resolveCspDirectiveAction, resolveCspReportAction } from "./_actions";

export function ResolveDirectiveButton({ directive }: { directive: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await resolveCspDirectiveAction(directive);
        });
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      <span>Resolver todo</span>
    </Button>
  );
}

export function ResolveReportButton({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="ml-auto h-6 px-2 text-xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await resolveCspReportAction(reportId);
        });
      }}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      Resolver
    </Button>
  );
}
