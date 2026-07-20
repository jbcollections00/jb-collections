"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import AdSlot from "@/app/components/AdSlot"
import SiteHeader from "@/app/components/SiteHeader"

// Top Banner Code (300x250)
const TOP_AD = `
  <div style="display:flex; justify-center; align-items:center;">
    <script type="text/javascript">
      atOptions = {
        'key' : 'b34ceb41f59688ea67157fc3adaa80c5',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    </script>
    <script type="text/javascript" src="https://www.highperformanceformat.com/b34ceb41f59688ea67157fc3adaa80c5/invoke.js"></script>
  </div>
`

// Bottom Banner Code (300x250)
const BOTTOM_AD = `
  <div style="display:flex; justify-center; align-items:center;">
    <script type="text/javascript">
      atOptions = {
        'key' : 'b34ceb41f59688ea67157fc3adaa80c5',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    </script>
    <script type="text/javascript" src="https://www.highperformanceformat.com/b34ceb41f59688ea67157fc3adaa80c5/invoke.js"></script>
  </div>
`

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ""

  // Hide navigation header on landing page, login, and signup pages
  const hideHeader =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")

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
    <div className="flex min-h-screen flex-col bg-[#020617] text-white">
      {/* Dynamic Blue Top Navigation Header with Coins & Menu */}
      {!hideHeader && <SiteHeader />}

      {/* 1. Header Banner Ad (Top) */}
      {!hideAds && (
        <section className="w-full border-b border-slate-800/80 bg-[#070e20] py-3">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-1 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              Advertisement
            </div>
            <div className="flex justify-center">
              <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40 p-1 shadow-sm">
                <AdSlot code={TOP_AD} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Page Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      {!hideFooter && (
        <footer className="mt-10 border-t border-white/10 bg-[#020617] py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-sm text-slate-300">
            
            {/* 2. Footer Banner Ad (Bottom) */}
            {!hideAds && (
              <div className="w-full">
                <div className="mb-1 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  Advertisement
                </div>
                <div className="flex justify-center">
                  <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40 p-1 shadow-sm">
                    <AdSlot code={BOTTOM_AD} />
                  </div>
                </div>
              </div>
            )}

            {/* Footer Navigation Links */}
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
              <Link href="/contact" className="transition hover:text-white">
                 Contact Us
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