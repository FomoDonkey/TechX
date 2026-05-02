import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().optional(),
    AUTH_SECRET: z.string().min(16).default("dev-secret-change-me-in-production-please-please"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    MISTRAL_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM: z.string().default("CSM <noreply@csm.dev>"),
    UPLOADTHING_TOKEN: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    REPLICATE_API_TOKEN: z.string().optional(),
    HUGGINGFACE_API_KEY: z.string().optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_S3_PUBLIC_URL: z.string().url().optional(),
    STORAGE_DRIVER: z.enum(["auto", "local", "uploadthing", "vercel-blob", "s3"]).default("auto"),
    STORAGE_LOCAL_DIR: z.string().default(".csm-uploads"),
    STORAGE_SIGNING_SECRET: z
      .string()
      .min(16)
      .default("dev-storage-secret-change-me-please-please-please"),
    API_KEY_PEPPER: z.string().min(16).default("dev-api-key-pepper-change-me-please-please-please"),
    CRON_SECRET: z.string().min(16).default("dev-cron-secret-change-me-please-please-please"),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("CSM"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_S3_PUBLIC_URL: process.env.AWS_S3_PUBLIC_URL,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR,
    STORAGE_SIGNING_SECRET: process.env.STORAGE_SIGNING_SECRET,
    API_KEY_PEPPER: process.env.API_KEY_PEPPER,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});

function detectStorageDriver(): "local" | "uploadthing" | "vercel-blob" | "s3" {
  if (env.STORAGE_DRIVER !== "auto") return env.STORAGE_DRIVER;
  if (env.UPLOADTHING_TOKEN) return "uploadthing";
  if (env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET) return "s3";
  return "local";
}

export const features = {
  ai: !!(env.GROQ_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.MISTRAL_API_KEY),
  email: !!env.RESEND_API_KEY,
  uploads: true,
  stripe: !!env.STRIPE_SECRET_KEY,
  imageGen: !!env.REPLICATE_API_TOKEN,
  vision: !!env.HUGGINGFACE_API_KEY,
  database: !!env.DATABASE_URL,
  storageDriver: detectStorageDriver(),
} as const;
