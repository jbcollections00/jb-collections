"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import AdSlot from "@/app/components/AdSlot"

// 🔥 PUT YOUR REAL AD CODES HERE
const TOP_AD = `<!-- top banner ad code -->`
const MIDDLE_AD = `<!-- in content ad code -->`
const BOTTOM_AD = `<!-- bottom ad code -->`

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ""

  const hideAds =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")

  const hideFooter =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")

  return (
    <div className="min-h-screen flex flex-col">
      {!hideAds && (
        <div className="w-full border-b bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <AdSlot code={TOP_AD} />
          </div>
        </div>
      )}

      <main className="flex-1">
        {!hideAds && (
          <div className="mx-auto max-w-6xl px-4 pt-4">
            <AdSlot code={MIDDLE_AD} />
          </div>
        )}

        {children}

        {!hideAds && (
          <div className="mx-auto max-w-6xl px-4 py-6">
            <AdSlot code={BOTTOM_AD} />
          </div>
        )}
      </main>

      {!hideFooter && (
        <footer className="mt-10 border-t bg-white py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-sm text-slate-500">
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/terms" className="hover:text-slate-900">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-slate-900">
                Privacy Policy
              </Link>
              <Link href="/disclaimer" className="hover:text-slate-900">
                Disclaimer
              </Link>
              <Link href="/refund-policy" className="hover:text-slate-900">
                Refund Policy
              </Link>
            </div>

            <div className="text-xs text-slate-400">
              © {new Date().getFullYear()} JB Collections. All rights reserved.
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}