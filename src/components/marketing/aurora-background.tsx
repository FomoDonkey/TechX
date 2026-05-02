import { cn } from "@/lib/utils";

export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div
        className="absolute -top-1/3 left-1/4 h-[60vw] w-[60vw] rounded-full opacity-40 mix-blend-screen blur-[140px]"
        style={{
          background: "radial-gradient(closest-side, oklch(0.72 0.25 290), transparent)",
          animation: "aurora 22s linear infinite",
        }}
      />
      <div
        className="absolute -bottom-1/3 right-1/4 h-[60vw] w-[60vw] rounded-full opacity-40 mix-blend-screen blur-[140px]"
        style={{
          background: "radial-gradient(closest-side, oklch(0.78 0.25 340), transparent)",
          animation: "aurora 18s linear infinite reverse",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 h-[50vw] w-[50vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 mix-blend-screen blur-[120px]"
        style={{
          background: "radial-gradient(closest-side, oklch(0.78 0.18 180), transparent)",
          animation: "aurora 30s linear infinite",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, oklch(from var(--foreground) l c h / 0.04) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
    </div>
  );
}
