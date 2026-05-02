"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useFormStatus } from "react-dom";

export function NewPostButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" className="rounded-xl" disabled={pending}>
      <Plus className="size-4" /> {pending ? "Creando…" : "Nueva entrada"}
    </Button>
  );
}
