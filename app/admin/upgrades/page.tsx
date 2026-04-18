"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Coins, ShieldCheck } from "lucide-react"
import AdminHeader from "@/app/components/AdminHeader"

export default function UpgradesPage() {
  const router = useRouter()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      router.replace("/admin/coin-purchases")
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [router])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#020617_0%,#0b1220_48%,#111827_100%)] px-4 py-4 text-white sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <AdminHeader />

        <section className="mt-4 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/75 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_45%,#111827_100%)]" />
            <div className="relative px-5 py-8 sm:px-6 sm:py-10 lg:px-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                Unified Admin Payments
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Redirecting to the official JB Coin purchase control center
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                The old upgrades page is now consolidated into the real admin payment dashboard so
                approval, rejection, auto-credit, and logs all happen in one place.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <ShieldCheck className="mb-3 text-emerald-300" size={22} />
                  <p className="font-black text-white">Protected admin access</p>
                  <p className="mt-1 text-sm text-slate-400">Only admins can reach the live purchase queue.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Coins className="mb-3 text-yellow-300" size={22} />
                  <p className="font-black text-white">Auto wallet credit</p>
                  <p className="mt-1 text-sm text-slate-400">Approvals instantly push coins into the user balance.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <ArrowRight className="mb-3 text-sky-300" size={22} />
                  <p className="font-black text-white">Clean redirect flow</p>
                  <p className="mt-1 text-sm text-slate-400">This page forwards to /admin/coin-purchases.</p>
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white">
                <span className="h-3 w-3 animate-pulse rounded-full bg-sky-400" />
                Loading /admin/coin-purchases...
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
