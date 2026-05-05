"use client";

import { toggleReactionAction } from "@/app/admin/workflows/_actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ReactionEvent, usePresence } from "@/presence/context";
import { SmilePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

export type InitialReaction = {
  messageId: string;
  emoji: string;
  count: number;
  mine: boolean;
};

const QUICK_EMOJIS = ["👍", "❤️", "🎉", "🚀", "👀", "🤔"] as const;

type Props = {
  threadId: string;
  messageId: string;
  myUserId: string;
  /** Reactions iniciales para este mensaje (todas las del mensaje, ya filtradas). */
  initial: InitialReaction[];
};

export function ThreadReactions({ threadId, messageId, myUserId, initial }: Props) {
  const presence = usePresence();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactions, setReactions] = useState<InitialReaction[]>(initial);
  const [animatingEmoji, setAnimatingEmoji] = useState<string | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suscripción al stream de presence para events live de este thread.
  useEffect(() => {
    const unsub = presence.subscribeReactions(threadId, (ev: ReactionEvent) => {
      if (ev.messageId !== messageId) return;
      // Mine-detection: si el evento viene del mismo usuario, ignoramos el
      // SSE (ya hicimos la mutación optimista). Las múltiples pestañas del
      // mismo user reciben el evento; dejamos que aplique para sincronizar.
      const fromMe = ev.userId === myUserId;
      setReactions((prev) => {
        const idx = prev.findIndex((r) => r.emoji === ev.emoji);
        if (ev.kind === "reaction.add") {
          if (idx >= 0) {
            const next = prev.slice();
            const r = next[idx];
            if (!r) return prev;
            next[idx] = {
              ...r,
              count: r.count + 1,
              mine: fromMe ? true : r.mine,
            };
            return next;
          }
          return [...prev, { messageId, emoji: ev.emoji, count: 1, mine: fromMe }];
        }
        // remove
        if (idx < 0) return prev;
        const r = prev[idx];
        if (!r) return prev;
        const newCount = Math.max(0, r.count - 1);
        if (newCount === 0) return prev.filter((_, i) => i !== idx);
        const next = prev.slice();
        next[idx] = { ...r, count: newCount, mine: fromMe ? false : r.mine };
        return next;
      });
      // Animación de "pulse" en el emoji que cambió.
      if (ev.kind === "reaction.add") {
        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        setAnimatingEmoji(ev.emoji);
        animTimerRef.current = setTimeout(() => setAnimatingEmoji(null), 600);
      }
    });
    return unsub;
  }, [presence, threadId, messageId, myUserId]);

  // Cleanup animation timer on unmount.
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  const sorted = useMemo(
    () => [...reactions].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji)),
    [reactions],
  );

  function toggle(emoji: string) {
    // Optimistic update: reflejamos el cambio antes del round-trip.
    setReactions((prev) => {
      const idx = prev.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const r = prev[idx];
        if (!r) return prev;
        if (r.mine) {
          const newCount = Math.max(0, r.count - 1);
          if (newCount === 0) return prev.filter((_, i) => i !== idx);
          const next = prev.slice();
          next[idx] = { ...r, count: newCount, mine: false };
          return next;
        }
        const next = prev.slice();
        next[idx] = { ...r, count: r.count + 1, mine: true };
        return next;
      }
      return [...prev, { messageId, emoji, count: 1, mine: true }];
    });
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    setAnimatingEmoji(emoji);
    animTimerRef.current = setTimeout(() => setAnimatingEmoji(null), 600);

    startTransition(async () => {
      const res = await toggleReactionAction({ messageId, emoji });
      if (!res.ok) {
        // Rollback en caso de error: revertimos el optimistic update.
        setReactions((prev) => {
          const idx = prev.findIndex((r) => r.emoji === emoji);
          if (idx < 0) return prev;
          const r = prev[idx];
          if (!r) return prev;
          if (r.mine) {
            const newCount = Math.max(0, r.count - 1);
            if (newCount === 0) return prev.filter((_, i) => i !== idx);
            const next = prev.slice();
            next[idx] = { ...r, count: newCount, mine: false };
            return next;
          }
          return prev;
        });
      }
    });
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {sorted.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={pending}
          onClick={() => toggle(r.emoji)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-all hover:scale-105",
            r.mine
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted",
            animatingEmoji === r.emoji && "animate-csm-pulse",
          )}
          aria-pressed={r.mine}
          title={r.mine ? "Quitar tu reacción" : `Reaccionar con ${r.emoji}`}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          <span className="tabular-nums leading-none">{r.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          aria-label="Añadir reacción"
        >
          <SmilePlus className="size-3" />
        </button>
        {pickerOpen ? (
          <div
            aria-label="Selector de emoji"
            className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  toggle(emoji);
                  setPickerOpen(false);
                }}
                className="h-7 w-7 px-0 text-base hover:scale-125 transition-transform"
              >
                {emoji}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
