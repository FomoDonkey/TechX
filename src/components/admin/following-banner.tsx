"use client";

import { Button } from "@/components/ui/button";
import { usePresence } from "@/presence/context";
import { Footprints, X } from "lucide-react";

/**
 * Banner global cuando el usuario activó "seguir a X". Aparece como sticky
 * top bajo la topbar; cuando el peer cambia de route, el provider navega y
 * este banner se mantiene reflejando el target.
 */
export function FollowingBanner() {
  const { follow, setFollow } = usePresence();
  if (!follow) return null;
  return (
    <div className="sticky top-14 z-30 flex items-center justify-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-1.5 text-xs backdrop-blur">
      <Footprints className="size-3.5" style={{ color: follow.user.color }} />
      <span className="text-foreground">
        Siguiendo a <span className="font-semibold">{follow.user.name}</span>
        <span className="ml-1.5 text-muted-foreground">· cambias de página con ella</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs"
        onClick={() => setFollow(null)}
      >
        <X className="size-3" /> Detener
      </Button>
    </div>
  );
}
