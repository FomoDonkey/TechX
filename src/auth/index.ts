import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env, features } from "@/env";
import { sendMagicLinkEmail } from "@/lib/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, twoFactor } from "better-auth/plugins";

function buildAuth() {
  if (!features.database || !db) return null;

  return betterAuth({
    appName: "CSM",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        twoFactor: schema.twoFactors,
      },
    }),
    secret: env.AUTH_SECRET,
    baseURL: env.NEXT_PUBLIC_APP_URL,
    trustedOrigins: [env.NEXT_PUBLIC_APP_URL],

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      autoSignIn: true,
    },

    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },

    user: {
      additionalFields: {
        locale: { type: "string", required: false, defaultValue: "es" },
        timezone: { type: "string", required: false, defaultValue: "Europe/Madrid" },
        onboardedAt: { type: "date", required: false },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },

    advanced: {
      cookiePrefix: "csm",
      useSecureCookies: env.NODE_ENV === "production",
    },

    plugins: [
      twoFactor({
        issuer: "CSM",
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const result = await sendMagicLinkEmail({ to: email, url });
          if (!result.ok && !result.mocked) {
            throw new Error("No se pudo enviar el enlace mágico");
          }
        },
        expiresIn: 60 * 10,
      }),
    ],
  });
}

export const auth = buildAuth();
export type Auth = NonNullable<typeof auth>;
