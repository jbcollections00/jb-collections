"use client"

import SiteHeader from "@/app/components/SiteHeader"

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-black text-slate-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Last updated: March 19, 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
            <section>
              <h2 className="text-lg font-bold text-slate-900">
                1. Information We Collect
              </h2>
              <p className="mt-2">
                We may collect your email, account data, and messages.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                2. Usage Data
              </h2>
              <p className="mt-2">
                We collect data like pages visited, downloads, and device info.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                3. Cookies
              </h2>
              <p className="mt-2">
                Cookies help maintain sessions and improve experience.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}