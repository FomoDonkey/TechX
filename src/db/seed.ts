import { db, schema } from "./client";

async function main() {
  if (!db) {
    console.error("❌ No hay DATABASE_URL configurada. Edita .env y vuelve a intentarlo.");
    process.exit(1);
  }

  console.log("🌱 Sembrando workspace demo...");

  const [ws] = await db
    .insert(schema.workspaces)
    .values({
      slug: "demo",
      name: "Demo · CSM",
      branding: {
        colors: { primary: "oklch(0.55 0.22 290)", accent: "oklch(0.72 0.25 340)" },
        font: "geist",
        voice: "cercano, claro, optimista",
      },
      defaultLocale: "es",
      locales: ["es", "en"],
    })
    .onConflictDoNothing()
    .returning();

  if (!ws) {
    console.log("ℹ️  Workspace ya existe, saltando seed.");
    return;
  }

  await db.insert(schema.collections).values([
    {
      workspaceId: ws.id,
      name: "Posts",
      slug: "posts",
      icon: "newspaper",
      isBuiltin: true,
      description: "Entradas del blog",
    },
    {
      workspaceId: ws.id,
      name: "Páginas",
      slug: "pages",
      icon: "file-text",
      isBuiltin: true,
      description: "Páginas estáticas",
    },
  ]);

  console.log("✅ Seed completo. Workspace:", ws.slug);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
