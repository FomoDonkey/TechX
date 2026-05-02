"use client";

import { cn } from "@/lib/utils";
import { Laptop, RefreshCw, Smartphone, Tablet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Device = "mobile" | "tablet" | "desktop";

const SIZES: Record<Device, { w: number; h: number; label: string }> = {
  mobile: { w: 390, h: 760, label: "iPhone 15" },
  tablet: { w: 820, h: 1180, label: "iPad Air" },
  desktop: { w: 1280, h: 800, label: "Desktop" },
};

type Props = {
  src: string;
  refreshKey: number;
  onClose: () => void;
};

export function PreviewPane({ src, refreshKey, onClose }: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadAt, setReloadAt] = useState(0);

  useEffect(() => {
    if (!iframeRef.current) return;
    // Bust cache by appending refreshKey as fragment — same URL, but forces reload
    iframeRef.current.src = refreshKey > 0 ? `${src}#k=${refreshKey}` : src;
    setReloadAt(Date.now());
  }, [refreshKey, src]);

  const cur = SIZES[device];

  return (
    <aside className="flex h-full w-full flex-col border-l bg-card/30">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/50 px-3 py-2 text-xs">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background p-0.5">
          <DeviceBtn
            current={device}
            value="mobile"
            set={setDevice}
            icon={<Smartphone className="size-3.5" />}
          />
          <DeviceBtn
            current={device}
            value="tablet"
            set={setDevice}
            icon={<Tablet className="size-3.5" />}
          />
          <DeviceBtn
            current={device}
            value="desktop"
            set={setDevice}
            icon={<Laptop className="size-3.5" />}
          />
        </div>
        <span className="hidden text-muted-foreground sm:inline">
          {cur.label} · {cur.w} × {cur.h}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (iframeRef.current) iframeRef.current.src = src;
              setReloadAt(Date.now());
            }}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
            aria-label="Refrescar"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
            aria-label="Cerrar preview"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-start justify-center overflow-auto bg-[radial-gradient(circle_at_top,oklch(from_var(--background)_calc(l*0.95)_c_h),var(--background))] p-4">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/30 transition-all",
            device !== "desktop" && "border-border",
          )}
          style={{ width: cur.w, height: cur.h, maxWidth: "100%" }}
        >
          <iframe
            ref={iframeRef}
            title="Preview"
            src={src}
            data-reload={reloadAt}
            className="h-full w-full border-0 bg-background"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </aside>
  );
}

function DeviceBtn({
  current,
  value,
  set,
  icon,
}: {
  current: Device;
  value: Device;
  set: (d: Device) => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => set(value)}
      className={cn(
        "grid size-7 place-items-center rounded-md transition-colors",
        current === value
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={value}
    >
      {icon}
    </button>
  );
}
