import Link from "next/link"
import SiteHeader from "@/app/components/SiteHeader"
import SiteFooter from "@/app/components/SiteFooter"

export const metadata = {
  title: "Contact Us | JB Collections",
  description:
    "Contact JB Collections for account concerns, membership, coins, rewards, password recovery, Telegram support, and other concerns.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-blue-500/20 bg-slate-900 shadow-[0_24px_70px_rgba(2,6,23,0.45)]">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.22),transparent_34%)]" />

            <div className="relative px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
              <div className="inline-flex rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">
                Support
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Contact Us
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                Need help with your JB Collections account, membership, coins,
                rewards, password recovery, download access, or other concerns?
                We are here to assist you.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/90 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.34)]">
            <h2 className="text-xl font-black text-white">
              Business Information
            </h2>

            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Business Name
                </div>
                <div className="mt-1 font-bold text-white">JB Collections</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Email Support
                </div>
                <a
                  href="mailto:jbcollections00@gmail.com"
                  className="mt-1 inline-block font-bold text-cyan-300 transition hover:text-cyan-200"
                >
                  jbcollections00@gmail.com
                </a>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Website
                </div>
                <a
                  href="https://jb-collections.com"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-bold text-cyan-300 transition hover:text-cyan-200"
                >
                  https://jb-collections.com
                </a>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Location
                </div>
                <div className="mt-1 font-bold text-white">Philippines</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/90 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.34)]">
            <h2 className="text-xl font-black text-white">Support Details</h2>

            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Telegram Username
                </div>
                <a
                  href="https://t.me/JB_Collections_2019"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-bold text-cyan-300 transition hover:text-cyan-200"
                >
                  @JB_Collections_2019
                </a>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Telegram Mobile
                </div>
                <a
                  href="tel:+639685289257"
                  className="mt-1 inline-block font-bold text-cyan-300 transition hover:text-cyan-200"
                >
                  +63 968 528 9257
                </a>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Business Hours
                </div>
                <div className="mt-1 font-bold text-white">Open 24 hours</div>
              </div>

              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
                  For Faster Support
                </div>
                <p className="mt-2 text-amber-100">
                  Please include your registered email, username, and a short
                  description of your concern.
                </p>
              </div>

              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">
                  Important
                </div>
                <p className="mt-2 text-red-100">
                  Please do not send your password. Our support team will never
                  ask for your password.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border border-slate-800 bg-slate-900/90 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.34)]">
          <h2 className="text-xl font-black text-white">
            What We Can Help With
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Account concerns",
              "Password recovery",
              "Email update",
              "Membership questions",
              "JB Coins concerns",
              "Rewards and referrals",
              "Download issues",
              "Payment issues",
              "Website support",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="mailto:jbcollections00@gmail.com"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Email Support
            </a>

            <a
              href="https://t.me/JB_Collections_2019"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-700"
            >
              Message on Telegram
            </a>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}