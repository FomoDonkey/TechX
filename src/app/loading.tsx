export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex items-center gap-3">
        <span className="relative flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-primary" />
        </span>
        <span className="text-sm text-muted-foreground">Cargando…</span>
      </div>
    </div>
  );
}
