import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db, schema } from "./client";
import { insertReturning } from "./dialect";

const DEMO_EMAIL = "demo@csm.dev";
const DEMO_PASSWORD = "demo1234";
const DEMO_NAME = "Demo CSM";

async function main() {
  if (!db) {
    console.error("❌ No hay DATABASE_URL configurada. Edita .env y vuelve a intentarlo.");
    process.exit(1);
  }
  if (!auth) {
    console.error("❌ Better-Auth no inicializado. ¿Falta DATABASE_URL?");
    process.exit(1);
  }

  console.log("🌱 Seed CSM (idempotente)");

  // 1) Workspace demo (idempotente por slug)
  let [ws] = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, "demo"))
    .limit(1);

  if (!ws) {
    const wsId = crypto.randomUUID();
    ws = (await insertReturning(schema.workspaces, {
      id: wsId,
      slug: "demo",
      name: "Demo · CSM",
      branding: {
        colors: { primary: "oklch(0.55 0.22 290)", accent: "oklch(0.72 0.25 340)" },
        font: "geist",
        voice: "cercano, claro, optimista",
      },
      defaultLocale: "es",
      locales: ["es", "en"],
    })) as typeof schema.workspaces.$inferSelect;
    console.log("  ✓ Workspace creado:", ws?.slug);
  } else {
    console.log("  · Workspace ya existe:", ws.slug);
  }
  if (!ws) throw new Error("No se pudo crear/leer el workspace demo");

  // 2) Colecciones builtin (idempotente por (ws, slug))
  for (const col of [
    { name: "Posts", slug: "posts", icon: "newspaper", description: "Entradas del blog" },
    { name: "Páginas", slug: "pages", icon: "file-text", description: "Páginas estáticas" },
  ]) {
    await db
      .insert(schema.collections)
      .values({ workspaceId: ws.id, isBuiltin: true, ...col })
      .onConflictDoNothing({ target: [schema.collections.workspaceId, schema.collections.slug] });
  }
  console.log("  ✓ Colecciones builtin (posts, pages)");

  // 2.5) Branch main por workspace (idempotente, F9b)
  const [existingMain] = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(eq(schema.branches.workspaceId, ws.id))
    .limit(1);
  if (!existingMain) {
    await db.insert(schema.branches).values({
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
    console.log("  ✓ Branch main creada");
  } else {
    console.log("  · Branch main ya existe");
  }

  // 3) Demo user vía Better-Auth (gestiona el hash de password correctamente)
  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    console.log("  · Usuario demo ya existe:", DEMO_EMAIL);
  } else {
    try {
      const result = await auth.api.signUpEmail({
        body: {
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          name: DEMO_NAME,
        },
      });
      userId = result.user.id;
      console.log("  ✓ Usuario demo creado:", DEMO_EMAIL, "/ pwd:", DEMO_PASSWORD);
    } catch (err) {
      console.error("  ✗ Falló signUpEmail:", err instanceof Error ? err.message : err);
      throw err;
    }
  }

  // 4) Asignar como owner del workspace (idempotente por (ws, user))
  const [existingMember] = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.userId, userId))
    .limit(1);

  if (existingMember && existingMember.workspaceId === ws.id) {
    console.log("  · Membresía owner ya existe");
  } else if (!existingMember) {
    await db.insert(schema.members).values({
      workspaceId: ws.id,
      userId,
      role: "owner",
    });
    console.log("  ✓ Usuario asignado como owner del workspace demo");
  }

  console.log("\n✅ Seed completo");
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("   Admin: http://localhost:3000/admin\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
