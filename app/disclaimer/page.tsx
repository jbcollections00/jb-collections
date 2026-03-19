export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-black text-slate-900">Content Disclaimer</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: March 19, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">Adults Only</h2>
            <p className="mt-2">
              JB COLLECTIONS is intended only for adults who are at least 18 years
              old, or the age of legal majority in their jurisdiction, whichever is
              higher.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">User Responsibility</h2>
            <p className="mt-2">
              By entering this website, you acknowledge that you are responsible for
              ensuring that access to this content is lawful in your country,
              region, or jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">No Access by Minors</h2>
            <p className="mt-2">
              Minors must not access this website. Parents and guardians are
              responsible for preventing access by minors through their devices,
              networks, and accounts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">Third-Party Content and Links</h2>
            <p className="mt-2">
              Some pages may include third-party advertising, short links, or
              external services. We do not control and are not responsible for the
              content, policies, or practices of third-party websites.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">No Warranty</h2>
            <p className="mt-2">
              All materials and services are provided as available, without any
              warranty of availability, accuracy, or fitness for a particular
              purpose, to the extent allowed by law.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}