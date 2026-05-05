"use client";

import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAbTestStatusAction } from "../_actions";

export function CompleteWithWinner({
  testId,
  variants,
  suggestedWinnerId,
}: {
  testId: string;
  variants: Array<{ id: string; label: string }>;
  suggestedWinnerId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState<string>(suggestedWinnerId ?? variants[0]?.id ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onConfirm() {
    start(async () => {
      const res = await setAbTestStatusAction({
        id: testId,
        action: "complete",
        winnerVariantId: winner || undefined,
      });
      if (!res.ok) alert(`Error: ${res.error}`);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="gap-1.5">
          <Trophy className="size-4" /> Cerrar test
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-background/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[160] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/70 bg-popover p-6 shadow-2xl shadow-black/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Title className="font-display text-lg font-semibold">
            Cerrar test con ganador
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Una vez cerrado, dejará de mostrarse a nuevos visitantes. Los assignments existentes se
            mantienen para auditoría.
          </Dialog.Description>
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Marcar como ganadora:</p>
            <div className="space-y-1.5">
              {variants.map((v) => (
                <label
                  key={v.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="winner"
                    value={v.id}
                    checked={winner === v.id}
                    onChange={() => setWinner(v.id)}
                  />
                  <span>{v.label}</span>
                  {suggestedWinnerId === v.id ? (
                    <span className="ml-auto text-[11px] text-emerald-300">sugerida</span>
                  ) : null}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/40">
                <input
                  type="radio"
                  name="winner"
                  value=""
                  checked={winner === ""}
                  onChange={() => setWinner("")}
                />
                <span>Empate / sin ganador</span>
              </label>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? "Cerrando…" : "Cerrar test"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
