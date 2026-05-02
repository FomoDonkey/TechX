"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as Dialog from "@radix-ui/react-dialog";
import { Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useUploader } from "./upload-provider";

export function PasteUrlDialog({
  trigger,
  folderId,
}: {
  trigger: React.ReactNode;
  folderId?: string | null;
}) {
  const { enqueueUrl } = useUploader();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error("URL inválida");
      return;
    }
    setLoading(true);
    try {
      await enqueueUrl(trimmed, folderId ?? null);
      setOpen(false);
      setUrl("");
      toast.success("Descargando…");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <Dialog.Title className="font-display text-lg font-semibold">
            Subir desde URL
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Pega la URL de una imagen, vídeo o PDF público.
          </Dialog.Description>
          <div className="mt-4 flex gap-2">
            <div className="flex flex-1 items-center rounded-lg border bg-background px-2 focus-within:ring-2 focus-within:ring-primary/40">
              <Link2 className="size-4 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Descargar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
