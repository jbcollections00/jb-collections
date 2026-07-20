"use client"

import Link from "next/link"

export default function SiteFooter() {
  return (
    <footer className="w-full bg-slate-950 py-10 text-center">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        {/* ADVERTISEMENT indicator */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
            ADVERTISEMENT
          </span>
          <div className="h-3 w-3 rounded-full border border-slate-700 bg-slate-900" />
        </div>

        {/* Links Navigation */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-base font-semibold text-slate-200">
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

        {/* Copyright */}
        <p className="text-sm text-slate-400">
          &copy; {new Date().getFullYear()} JB Collections. All rights reserved.
        </p>
      </div>
    </footer>
  )
}