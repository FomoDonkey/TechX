"use server";

import { unsubscribe, updatePreferences } from "@/newsletter/subscribers";
import { z } from "zod";

const UnsubSchema = z.object({
  token: z.string().min(1).max(2048),
  reason: z.string().max(200).optional(),
});

export async function unsubscribeAction(input: z.input<typeof UnsubSchema>) {
  const parsed = UnsubSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const result = await unsubscribe({ token: parsed.data.token, reason: parsed.data.reason });
  return result.ok
    ? { ok: true as const }
    : { ok: false as const, error: result.error ?? "failed" };
}

const PreferencesSchema = z.object({
  token: z.string().min(1).max(2048),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  preferences: z.record(z.unknown()).optional(),
});

export async function updatePreferencesAction(input: z.input<typeof PreferencesSchema>) {
  const parsed = PreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };
  const result = await updatePreferences({
    token: parsed.data.token,
    tags: parsed.data.tags,
    preferences: parsed.data.preferences,
  });
  return result.ok
    ? { ok: true as const, subscriber: result.subscriber ?? null }
    : { ok: false as const, error: result.error ?? "failed" };
}
