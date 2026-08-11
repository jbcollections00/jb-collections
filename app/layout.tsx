import "./globals.css"
import type { Metadata } from "next"
import Script from "next/script"
import LayoutShell from "./components/LayoutShell"
import BackgroundAds from "@/app/components/BackgroundAds"
import ScriptElementGuard from "./components/ScriptElementGuard"

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://jb-collections.com"
  ).replace(/\/+$/, "")
}

const siteUrl = getSiteUrl()
const defaultPreview = `${siteUrl}/default-preview.jpg`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "JB Collections",
  description: "Premium-ready file download platform",
  openGraph: {
    title: "JB Collections",
    description: "Premium-ready file download platform",
    url: siteUrl,
    siteName: "JB Collections",
    type: "website",
    images: [
      {
        url: defaultPreview,
        width: 1200,
        height: 630,
        alt: "JB Collections",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JB Collections",
    description: "Premium-ready file download platform",
    images: [defaultPreview],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* ✅ Google AdSense Script */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6646475793737493"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        {/* 🛡️ Client-side safe guard component */}
        <ScriptElementGuard />

        <LayoutShell>{children}</LayoutShell>

        {/* 🔥 Background & Popunder Ads */}
        <BackgroundAds />
      </body>
    </html>
  )
}