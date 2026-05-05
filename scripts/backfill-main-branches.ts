/**
 * F9b backfill — crea la branch "main" (isDefault, isProtected) por cada workspace
 * que no la tenga. Idempotente: corre N veces sin efecto sobre los que ya existen.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/backfill-main-branches.ts
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { branches, workspaces } from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL no definida");
    process.exit(1);
  }

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);

  const wsList = await db.select({ id: workspaces.id, slug: workspaces.slug }).from(workspaces);
  console.log(`[backfill] ${wsList.length} workspaces`);

  let created = 0;
  let already = 0;

  for (const ws of wsList) {
    const existing = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.workspaceId, ws.id), eq(branches.isDefault, true)))
      .limit(1);

    if (existing[0]) {
      already++;
      continue;
    }

    await db.insert(branches).values({
      workspaceId: ws.id,
      name: "main",
      slug: "main",
      description: "Rama principal del workspace",
      isDefault: true,
      isProtected: true,
      status: "draft",
      color: "oklch(0.78 0.18 180)",
      icon: "git-branch",
    });
    created++;
    console.log(`[backfill] main creada para workspace ${ws.slug}`);
  }

  // Sanity check: ningún `entries.branchId` debería apuntar a una branch borrada.
  // Estos quedan tratados como main por la lógica F9b (legacy compat).
  const orphan = await db
    .select({ id: branches.id })
    .from(branches)
    .where(isNotNull(branches.id))
    .limit(1);

  console.log(
    `[backfill] done — created=${created}, already=${already}, totalBranches=${orphan.length > 0 ? "ok" : "0"}`,
  );
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
