import Link from "next/link"

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#020617] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* LINKS */}
        <div className="flex flex-wrap justify-center gap-6 text-sm font-medium">
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
            Contact
          </Link>
        </div>

        {/* DIVIDER */}
        <div className="my-6 h-px w-full bg-white/10" />

        {/* COPYRIGHT */}
        <p className="text-center text-xs text-slate-400">
          © 2026 JB Collections. All rights reserved.
        </p>
      </div>
    </footer>
  )
}