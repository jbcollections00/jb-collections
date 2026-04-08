"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
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
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")

  const hideFooter =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")

  useEffect(() => {
    function handleGlobalCoinUpdate() {
      console.log("Coins updated globally")
    }

    window.addEventListener("jb-coins-updated", handleGlobalCoinUpdate)

    return () => {
      window.removeEventListener("jb-coins-updated", handleGlobalCoinUpdate)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-white">
      {!hideAds && (
        <div className="w-full border-b border-white/10 bg-[#061229]">
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
        <footer className="mt-10 border-t border-white/10 bg-[#020617] py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-sm text-slate-300">
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
              <Link href="/privacy" className="transition hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/disclaimer" className="transition hover:text-white">
                Disclaimer
              </Link>
              <Link href="/refund-policy" className="transition hover:text-white">
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