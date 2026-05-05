import { CookieConsent } from "@/components/cookie-consent";
import { ThemeProvider } from "@/components/theme-provider";
import { env } from "@/env";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "CSM — Content Spectacular Machine",
    template: "%s · CSM",
  },
  description:
    "El CMS moderno que reemplaza WordPress. Editor estilo Notion, diseño estilo Framer, IA nativa, multi-tenant. Open source y gratis para empezar.",
  applicationName: "CSM",
  authors: [{ name: "CSM" }],
  generator: "CSM",
  keywords: [
    "CMS",
    "headless CMS",
    "WordPress alternative",
    "Notion editor",
    "AI CMS",
    "open source CMS",
    "Next.js CMS",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: env.NEXT_PUBLIC_APP_URL,
    siteName: "CSM",
    title: "CSM — Content Spectacular Machine",
    description:
      "Publica como en Notion. Diseña como en Framer. Escala como Vercel. Mide como Linear.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CSM — Content Spectacular Machine",
    description:
      "Publica como en Notion. Diseña como en Framer. Escala como Vercel. Mide como Linear.",
  },
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/feed.xml",
      "application/atom+xml": "/feed.atom",
      "application/feed+json": "/feed.json",
    },
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a14" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
