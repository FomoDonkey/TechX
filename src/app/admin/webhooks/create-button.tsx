"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { WebhookFormDialog } from "./form-dialog";

export function CreateWebhookButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo webhook
      </Button>
      <WebhookFormDialog open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}
