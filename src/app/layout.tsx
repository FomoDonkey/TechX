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
    default: "techx — el CMS espectacular",
    template: "%s · techx",
  },
  description:
    "Plataforma de contenido moderna, AI-native y headless-first. Edición colaborativa en tiempo real, búsqueda semántica, automaticación editorial. Open source.",
  applicationName: "techx",
  authors: [{ name: "techx" }],
  generator: "techx",
  keywords: [
    "CMS",
    "headless CMS",
    "AI CMS",
    "open source CMS",
    "edición colaborativa",
    "Next.js CMS",
    "techx",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: env.NEXT_PUBLIC_APP_URL,
    siteName: "techx",
    title: "techx — el CMS espectacular",
    description:
      "Edita en colaboración real. Diseña visualmente. Publica con IA. Despliega en segundos.",
  },
  twitter: {
    card: "summary_large_image",
    title: "techx — el CMS espectacular",
    description:
      "Edita en colaboración real. Diseña visualmente. Publica con IA. Despliega en segundos.",
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
    { media: "(prefers-color-scheme: dark)", color: "#150a0a" },
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
