import { db } from "@/db/client";
import { editorialMessages, editorialReactions, editorialThreads } from "@/db/schema";
import { publishPubsub } from "@/lib/pubsub";
import { PRESENCE_CHANNEL } from "@/presence/server";
import { and, eq, inArray } from "drizzle-orm";

const MAX_EMOJI_LEN = 8;
/** Whitelist conservadora — ZWJ emojis pueden tener varios codepoints. */
const ALLOWED_EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍)+$/u;

export type ReactionPayload = {
  kind: "reaction.add" | "reaction.remove";
  workspaceId: string;
  threadId: string;
  messageId: string;
  userId: string;
  userName: string | null;
  emoji: string;
  ts: number;
};

function validEmoji(s: string): boolean {
  if (!s || s.length > MAX_EMOJI_LEN) return false;
  return ALLOWED_EMOJI_RE.test(s);
}

/**
 * Toggle idempotente: si la reaction (messageId, userId, emoji) existe → DELETE.
 * Si no existe → INSERT. En ambos casos NOTIFY al canal del workspace.
 *
 * Re-comprueba que el message pertenece al workspace para evitar cross-tenant.
 */
export async function toggleReaction(input: {
  workspaceId: string;
  userId: string;
  userName: string | null;
  messageId: string;
  emoji: string;
}): Promise<{ ok: true; added: boolean } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: "db_unavailable" };
  if (!validEmoji(input.emoji)) return { ok: false, error: "invalid_emoji" };

  // Re-check: message ∈ thread ∈ workspace.
  const [msg] = await db
    .select({
      id: editorialMessages.id,
      threadId: editorialMessages.threadId,
      workspaceId: editorialMessages.workspaceId,
    })
    .from(editorialMessages)
    .where(eq(editorialMessages.id, input.messageId))
    .limit(1);
  if (!msg || msg.workspaceId !== input.workspaceId) {
    return { ok: false, error: "not_found" };
  }

  // Verificar el message pertenece al workspace + thread (defense-in-depth).
  const [thread] = await db
    .select({ id: editorialThreads.id, workspaceId: editorialThreads.workspaceId })
    .from(editorialThreads)
    .where(eq(editorialThreads.id, msg.threadId))
    .limit(1);
  if (!thread || thread.workspaceId !== input.workspaceId) {
    return { ok: false, error: "not_found" };
  }

  const existing = await db
    .select({ id: editorialReactions.id })
    .from(editorialReactions)
    .where(
      and(
        eq(editorialReactions.messageId, input.messageId),
        eq(editorialReactions.userId, input.userId),
        eq(editorialReactions.emoji, input.emoji),
      ),
    )
    .limit(1);

  let added: boolean;
  if (existing.length > 0) {
    await db.delete(editorialReactions).where(eq(editorialReactions.id, existing[0]?.id ?? ""));
    added = false;
  } else {
    await db.insert(editorialReactions).values({
      workspaceId: input.workspaceId,
      messageId: input.messageId,
      threadId: msg.threadId,
      userId: input.userId,
      emoji: input.emoji,
    });
    added = true;
  }

  await publishPubsub(PRESENCE_CHANNEL(input.workspaceId), {
    kind: added ? "reaction.add" : "reaction.remove",
    workspaceId: input.workspaceId,
    threadId: msg.threadId,
    messageId: input.messageId,
    userId: input.userId,
    userName: input.userName,
    emoji: input.emoji,
    ts: Date.now(),
  } satisfies ReactionPayload);

  return { ok: true, added };
}

export type MessageReactionsAggregated = {
  messageId: string;
  emoji: string;
  count: number;
  /** True si el user actual reaccionó con este emoji al mensaje. */
  mine: boolean;
};

/**
 * Carga reactions agrupadas por (messageId, emoji) para un thread completo.
 * Devuelve [{messageId, emoji, count, mine}] que el cliente agrupa por message.
 */
export async function loadThreadReactions(opts: {
  workspaceId: string;
  threadId: string;
  myUserId: string;
}): Promise<MessageReactionsAggregated[]> {
  if (!db) return [];
  const rows = await db
    .select({
      messageId: editorialReactions.messageId,
      userId: editorialReactions.userId,
      emoji: editorialReactions.emoji,
    })
    .from(editorialReactions)
    .where(
      and(
        eq(editorialReactions.workspaceId, opts.workspaceId),
        eq(editorialReactions.threadId, opts.threadId),
      ),
    );
  const counter = new Map<
    string,
    { messageId: string; emoji: string; count: number; mine: boolean }
  >();
  for (const r of rows) {
    const key = `${r.messageId}::${r.emoji}`;
    const cur = counter.get(key);
    if (cur) {
      cur.count += 1;
      if (r.userId === opts.myUserId) cur.mine = true;
    } else {
      counter.set(key, {
        messageId: r.messageId,
        emoji: r.emoji,
        count: 1,
        mine: r.userId === opts.myUserId,
      });
    }
  }
  return Array.from(counter.values());
}

/** Versión multi-thread para hidratar el drawer en una sola query. */
export async function loadReactionsForThreads(opts: {
  workspaceId: string;
  threadIds: string[];
  myUserId: string;
}): Promise<MessageReactionsAggregated[]> {
  if (!db || opts.threadIds.length === 0) return [];
  const rows = await db
    .select({
      messageId: editorialReactions.messageId,
      userId: editorialReactions.userId,
      emoji: editorialReactions.emoji,
    })
    .from(editorialReactions)
    .where(
      and(
        eq(editorialReactions.workspaceId, opts.workspaceId),
        inArray(editorialReactions.threadId, opts.threadIds),
      ),
    );
  const counter = new Map<
    string,
    { messageId: string; emoji: string; count: number; mine: boolean }
  >();
  for (const r of rows) {
    const key = `${r.messageId}::${r.emoji}`;
    const cur = counter.get(key);
    if (cur) {
      cur.count += 1;
      if (r.userId === opts.myUserId) cur.mine = true;
    } else {
      counter.set(key, {
        messageId: r.messageId,
        emoji: r.emoji,
        count: 1,
        mine: r.userId === opts.myUserId,
      });
    }
  }
  return Array.from(counter.values());
}
