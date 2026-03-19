export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-black text-slate-900">Refund & Membership Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: March 19, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">1. Membership Access</h2>
            <p className="mt-2">
              Paid memberships provide access to eligible member-only content and
              features for the period purchased, subject to account standing and site
              availability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">2. Digital Product Nature</h2>
            <p className="mt-2">
              Because memberships and downloads involve digital access, all sales may
              be treated as final once access has been granted, except where refunds
              are required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">3. Possible Refund Review</h2>
            <p className="mt-2">
              Refund requests may be reviewed on a case-by-case basis for issues such
              as duplicate charges, failed access caused by our system, or billing
              errors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">4. Abuse and Chargebacks</h2>
            <p className="mt-2">
              We reserve the right to suspend accounts involved in payment abuse,
              fraudulent claims, unauthorized sharing, or abusive chargebacks.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">5. Policy Changes</h2>
            <p className="mt-2">
              We may update membership pricing, feature access, and refund handling
              from time to time by posting changes on this website.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}