"use client";

import { type MediaRow, mediaKind } from "@/lib/media-types";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Music, Video } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function fmt(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function thumbUrl(item: MediaRow): string {
  const v = item.variants as {
    sizes?: { thumb?: { webp?: { url?: string }; avif?: { url?: string } } };
  } | null;
  return v?.sizes?.thumb?.webp?.url ?? v?.sizes?.thumb?.avif?.url ?? item.url;
}

export function MediaList({ items }: { items: MediaRow[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function open(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("asset", id);
    router.replace(`/admin/medios?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Archivo</th>
            <th className="px-4 py-2.5">Tipo</th>
            <th className="px-4 py-2.5">Tamaño</th>
            <th className="px-4 py-2.5">Dim.</th>
            <th className="px-4 py-2.5">Alt</th>
            <th className="px-4 py-2.5">Subido</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const kind = mediaKind(it.mime);
            return (
              <tr
                key={it.id}
                onClick={() => open(it.id)}
                className="cursor-pointer border-b transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {kind === "image" ? (
                      <img
                        src={thumbUrl(it)}
                        alt=""
                        className="size-10 rounded object-cover"
                        style={{
                          objectPosition: `${it.focalX ?? 50}% ${it.focalY ?? 50}%`,
                          backgroundColor: it.dominantColor ?? undefined,
                        }}
                      />
                    ) : (
                      <span className="grid size-10 place-items-center rounded bg-muted text-muted-foreground">
                        {kind === "video" ? <Video className="size-4" /> : null}
                        {kind === "audio" ? <Music className="size-4" /> : null}
                        {kind === "doc" ? <FileText className="size-4" /> : null}
                        {kind === "other" ? <ImageIcon className="size-4" /> : null}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{it.filename ?? "Sin nombre"}</div>
                      <div className="text-xs text-muted-foreground">{it.mime}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 capitalize text-muted-foreground">{kind}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{fmt(it.size)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {it.width && it.height ? `${it.width}×${it.height}` : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {it.alt ? (
                    <span className="line-clamp-1 max-w-xs text-muted-foreground">{it.alt}</span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                      sin alt
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {new Date(it.createdAt).toLocaleDateString("es")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
