import "./globals.css"
import type { Metadata } from "next"
import LayoutShell from "./components/LayoutShell"

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
      <head>
        {/* ✅ AdSense Script (ADDED) */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6646475793737493"
          crossOrigin="anonymous"
        ></script>

        {/* existing icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
      </head>

      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}