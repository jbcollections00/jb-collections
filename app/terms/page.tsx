"use client"

import SiteHeader from "@/app/components/SiteHeader"

export default function TermsPage() {
  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-black text-slate-900">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Last updated: March 19, 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
            <section>
              <h2 className="text-lg font-bold text-slate-900">
                1. Acceptance of Terms
              </h2>
              <p className="mt-2">
                By accessing or using JB COLLECTIONS, you agree to be bound by
                these Terms of Service. If you do not agree, please do not use this
                website.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                2. Age Requirement
              </h2>
              <p className="mt-2">
                This website is intended only for adults who are at least 18 years
                old, or the age of legal majority in their location, whichever is
                higher. By using this website, you confirm that you meet this
                requirement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                3. User Accounts
              </h2>
              <p className="mt-2">
                You are responsible for maintaining the confidentiality of your
                account and password. You are responsible for all activity that
                occurs under your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                4. Memberships and Access
              </h2>
              <p className="mt-2">
                Some files and features may be limited to Free, Premium, or other
                paid membership tiers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                5. Acceptable Use
              </h2>
              <p className="mt-2">
                You agree not to misuse the site, bypass access controls, share
                accounts, or interfere with the operation of the website.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                6. Intellectual Property
              </h2>
              <p className="mt-2">
                All content is owned or licensed by JB COLLECTIONS. You may not
                redistribute or republish content without permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">
                7. Disclaimer
              </h2>
              <p className="mt-2">
                The website is provided “as is” without warranties of any kind.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}