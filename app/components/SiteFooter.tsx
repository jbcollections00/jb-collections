import Link from "next/link"

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 JB COLLECTIONS. All rights reserved.</p>

        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="transition hover:text-slate-900">
            Terms
          </Link>
          <Link href="/privacy" className="transition hover:text-slate-900">
            Privacy
          </Link>
          <Link href="/disclaimer" className="transition hover:text-slate-900">
            Disclaimer
          </Link>
          <Link href="/refund-policy" className="transition hover:text-slate-900">
            Refund Policy
          </Link>
          <Link href="/contact" className="transition hover:text-slate-900">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  )
}