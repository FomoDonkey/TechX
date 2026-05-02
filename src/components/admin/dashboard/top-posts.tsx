import { RelativeTime } from "@/components/admin/dashboard/relative-time";
import { Card } from "@/components/ui/card";
import type { TopPostRow } from "@/lib/dashboard";
import { ArrowUpRight, Eye } from "lucide-react";
import Link from "next/link";

export function TopPosts({ rows, workspaceSlug }: { rows: TopPostRow[]; workspaceSlug: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Posts publicados recientes</h2>
        <Link href="/admin/contenido" className="text-xs text-primary hover:underline">
          Ver todos
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-border/60">
        {rows.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
            Sin posts publicados aún. Crea uno con ⌘K → "Crear nueva entrada".
          </li>
        ) : (
          rows.map((p) => (
            <li key={p.id} className="group flex items-center gap-3 py-3 first:pt-0">
              <Link
                href={`/admin/contenido/${p.id}`}
                className="flex flex-1 flex-col gap-0.5 truncate"
              >
                <span className="truncate text-sm font-medium group-hover:text-primary">
                  {p.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.publishedAt ? (
                    <RelativeTime prefix="publicado" date={p.publishedAt} />
                  ) : (
                    "borrador"
                  )}
                  <span className="mx-1.5">·</span>/{workspaceSlug}/blog/{p.slug}
                </span>
              </Link>
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                <Eye className="size-3" /> {p.views}
              </span>
              <Link
                href={`/blog/${p.slug}`}
                target="_blank"
                rel="noopener"
                className="text-muted-foreground transition-colors hover:text-foreground"
                title="Abrir en sitio público"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
