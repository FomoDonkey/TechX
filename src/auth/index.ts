import { db, dialect } from "@/db/client";
import * as schema from "@/db/schema";
import { env, features } from "@/env";
import { sendEmailVerification, sendMagicLinkEmail } from "@/lib/email";
import { anonymizeIp } from "@/lib/ip-anon";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, twoFactor } from "better-auth/plugins";

function buildAuth() {
  if (!features.database || !db) return null;

  return betterAuth({
    appName: "CSM",
    database: drizzleAdapter(db, {
      // Better-Auth soporta "pg" / "mysql" / "sqlite". Detectamos del
      // DATABASE_URL via `dialect` para que el mismo build funcione contra
      // ambos motores sin tocar la config.
      provider: dialect === "mysql" ? "mysql" : "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        twoFactor: schema.twoFactors,
        rateLimit: schema.rateLimits,
      },
    }),
    secret: env.AUTH_SECRET,
    baseURL: env.NEXT_PUBLIC_APP_URL,
    // `trustedOrigins` controla los Origin headers que Better-Auth acepta para
    // OAuth callbacks y CSRF. En self-hosted (EC2) puede ser distinto al
    // dominio que está detrás de Caddy — por eso permitimos extras vía env.
    // Ej: AUTH_EXTRA_ORIGINS=https://csm.example.com,http://1.2.3.4:3000
    trustedOrigins: [
      env.NEXT_PUBLIC_APP_URL,
      ...(process.env.AUTH_EXTRA_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
    ],

    emailAndPassword: {
      enabled: true,
      // No bloqueamos signup ni signin por verificación: la cuenta se crea y
      // el user puede usar el admin libremente. La verificación es un GATE
      // sólo para acciones sensibles (upgradear a plan paid). Filosofía: el
      // free tier es libre, el paid exige email verificado para evitar abuso
      // de tarjetas robadas con email throwaway.
      requireEmailVerification: false,
      minPasswordLength: 8,
      autoSignIn: true,
      sendResetPassword: async () => {
        // Stub para futuro flow de recuperación. Sin esto better-auth lanza si
        // alguien pulsa "olvidé contraseña" antes de que tengamos UI.
      },
    },

    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60, // 1h
      sendVerificationEmail: async ({ user, url }) => {
        const result = await sendEmailVerification({ to: user.email, url });
        if (!result.ok && !result.mocked) {
          throw new Error("No se pudo enviar el email de verificación");
        }
      },
    },

    /**
     * Rate-limit en endpoints sensibles. Storage `database` es lo único que
     * funciona en Vercel Fluid Compute con instancias múltiples; `memory`
     * deja al atacante rotar entre instancias.
     *
     * Reglas calibradas para humano-real (no bots ni MFA hardware):
     * - sign-in/email          : 5 intentos por 60s (brute force password)
     * - two-factor/verify-totp : 5 por 60s (brute force 6 dígitos = 1M combos
     *                            → con 5/min son 12k/día, suficiente para
     *                            tener probabilidad ínfima)
     * - two-factor/verify-backup-code : 10 por 60s (códigos alfanuméricos largos
     *                                    pero el user puede tener varios y errar)
     * - magic-link/send        : 3 por 60s (anti-spam de envío)
     * - passkey login          : 10 por 60s (suele ser one-shot pero hay reintentos)
     * - send-verification-email: 3 por 60s (anti-spam Resend cost)
     */
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 10 },
        "/sign-in/magic-link": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
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

    /**
     * Hook GDPR: trunca la IP antes de persistir en `sessions.ipAddress`.
     * Better-Auth llama estos hooks justo antes del INSERT (ver `databaseHooks`
     * en `node_modules/better-auth/dist/db/hooks.mjs`). Devuelve `{ data: ... }`
     * para sustituir el valor — política `anonymizeIp` (mask, no hash) preserva
     * geolocalización aproximada para la UI de sesiones sin re-identificación.
     */
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const next = {
              ...session,
              ipAddress: anonymizeIp(session.ipAddress),
            };
            return { data: next };
          },
        },
        update: {
          before: async (session) => {
            if (typeof session.ipAddress === "string") {
              return { data: { ...session, ipAddress: anonymizeIp(session.ipAddress) } };
            }
            return { data: session };
          },
        },
      },
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
