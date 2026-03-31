"use client"

import SiteHeader from "@/app/components/SiteHeader"

export default function DisclaimerPage() {
  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-black text-slate-900">
            Content Disclaimer
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Last updated: March 19, 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
            <section>
              <h2 className="text-lg font-bold text-slate-900">
                Adults Only
              </h2>
              <p className="mt-2">
                This website is intended only for users 18+.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                User Responsibility
              </h2>
              <p className="mt-2">
                You are responsible for legal access in your country.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                No Access by Minors
              </h2>
              <p className="mt-2">
                Minors must not access this website.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}