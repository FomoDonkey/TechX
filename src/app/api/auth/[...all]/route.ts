import { auth } from "@/auth";

const notConfigured = () =>
  Response.json(
    {
      error: "Auth no configurado",
      hint: "Define DATABASE_URL en .env y ejecuta `npm run db:push` para activar el login.",
    },
    { status: 503 },
  );

export const GET = auth ? auth.handler : notConfigured;
export const POST = auth ? auth.handler : notConfigured;
