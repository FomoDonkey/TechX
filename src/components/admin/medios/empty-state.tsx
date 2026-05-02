"use client";

import { useUploader } from "@/components/admin/uploader/upload-provider";
import { Button } from "@/components/ui/button";
import { ImagePlus, Sparkles, UploadCloud } from "lucide-react";

export function MediosEmpty() {
  const { open } = useUploader();
  return (
    <div className="grid place-items-center px-4 py-20">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10">
          <ImagePlus className="size-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Tu biblioteca está vacía</h2>
        <p className="text-muted-foreground">
          Arrastra archivos a cualquier parte del panel, pega una imagen del portapapeles, o usa el
          botón Subir. También puedes pegar una URL.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={open} className="gap-1.5">
            <UploadCloud className="size-4" />
            Subir archivos
          </Button>
        </div>
        <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" /> Las imágenes se procesan
            automáticamente: variantes responsive, blurhash, color dominante.
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" /> Pega cualquier captura con
            ⌘V y se sube al instante.
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" /> Atajo:{" "}
            <kbd className="rounded bg-muted px-1">U</kbd> abre el selector.
          </li>
        </ul>
      </div>
    </div>
  );
}
