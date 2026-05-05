"use client";

import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { requestDeletionAction } from "./_actions";

/**
 * Botón con confirmación double-prompt para solicitar eliminación de cuenta.
 * Pide al user que escriba "ELIMINAR" como anti-clic-accidental.
 */
export function RequestDeletionButton() {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const typed = window.prompt(
      'Escribe "ELIMINAR" para confirmar la solicitud. Tendrás 30 días para cancelarla antes del borrado definitivo.',
    );
    if (typed?.trim().toUpperCase() !== "ELIMINAR") return;
    startTransition(async () => {
      await requestDeletionAction();
    });
  }

  return (
    <Button type="button" variant="destructive" onClick={onClick} disabled={pending}>
      {pending ? "Solicitando…" : "Solicitar eliminación"}
    </Button>
  );
}
