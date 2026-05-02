"use client";

import { createEntryInCollectionAction } from "@/app/admin/contenido/_actions";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";
import { Loader2, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type Collection = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  isBuiltin: boolean;
  totalCount: number;
};

function lucide(name: string | null) {
  const Cmp = (Icons as unknown as Record<string, React.FC<{ className?: string }>>)[
    name ?? "Layers"
  ];
  return Cmp ?? Icons.Layers;
}

export function CollectionContentHeader({ collection }: { collection: Collection }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = lucide(collection.icon);

  function onCreate() {
    startTransition(async () => {
      const res = await createEntryInCollectionAction({ collectionId: collection.id });
      if (res.ok) {
        router.push(`/admin/contenido/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Icon className="size-3.5" /> Colección
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">
          {collection.name} <span className="text-muted-foreground">· {collection.totalCount}</span>
        </h1>
        {collection.description ? (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{collection.description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/colecciones/${collection.id}`}
          className="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm hover:bg-muted"
        >
          <Settings2 className="size-4" />
          Schema
        </Link>
        <Button onClick={onCreate} disabled={pending} variant="gradient">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Nueva entrada
        </Button>
      </div>
    </header>
  );
}
