import "./globals.css"
import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import AdSlot from "@/app/components/AdSlot"

// 🔥 PUT YOUR REAL AD CODES HERE
const TOP_AD = `<!-- top banner ad code -->`
const MIDDLE_AD = `<!-- in content ad code -->`
const BOTTOM_AD = `<!-- bottom ad code -->`

export const metadata: Metadata = {
  title: "JB Collections",
  description: "Premium-ready file download platform",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ✅ FIX HERE
  const headerList = await headers()
  const pathname = headerList.get("x-pathname") || ""

  const hideAds =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
      </head>

      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col">

        {/* 🔝 TOP AD */}
        {!hideAds && (
          <div className="w-full bg-white border-b">
            <div className="max-w-6xl mx-auto px-4 py-3">
              <AdSlot code={TOP_AD} />
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1">

          {/* 🔹 MIDDLE AD */}
          {!hideAds && (
            <div className="max-w-6xl mx-auto px-4 pt-4">
              <AdSlot code={MIDDLE_AD} />
            </div>
          )}

          {children}

          {/* 🔻 BOTTOM AD */}
          {!hideAds && (
            <div className="max-w-6xl mx-auto px-4 py-6">
              <AdSlot code={BOTTOM_AD} />
            </div>
          )}

        </main>

        {/* FOOTER */}
        <footer className="border-t bg-white py-6 mt-10">
          <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-3 text-sm text-slate-500">

            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/terms" className="hover:text-slate-900">Terms</Link>
              <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
              <Link href="/disclaimer" className="hover:text-slate-900">Disclaimer</Link>
              <Link href="/refund-policy" className="hover:text-slate-900">Refund Policy</Link>
            </div>

            <div className="text-xs text-slate-400">
              © {new Date().getFullYear()} JB Collections. All rights reserved.
            </div>

          </div>
        </footer>

      </body>
    </html>
  )
}