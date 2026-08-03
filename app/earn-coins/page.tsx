"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import PresenceTracker from "@/app/components/PresenceTracker"
import SiteHeader from "@/app/components/SiteHeader"
import DailyRewardCard from "@/app/components/DailyRewardCard"
import EarnTasksSection from "@/app/components/EarnTasksSection"

type OfferwallProvider = "monlix" | "cpagrip"

function EarnCoinsPageContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OfferwallProvider>("cpagrip")

  useEffect(() => {
    async function checkUser() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error || !user) {
          router.replace("/login")
          return
        }

        setUserId(user.id)
      } finally {
        setCheckingAuth(false)
      }
    }

    void checkUser()
  }, [router, supabase])

  // Offerwall URLs configured with your exact CPAGrip details
  const offerwallUrls = {
    cpagrip: `https://www.cpagrip.com/show.php?l=0&u=2546994&id=1907578&subid=${userId || ""}`,
    monlix: `https://iframe.monlix.com/wall?appId=YOUR_MONLIX_APP_ID&userId=${userId || ""}`,
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 text-white">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] px-8 py-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <p className="text-lg font-semibold text-white">Checking your account...</p>
          <p className="mt-2 text-sm text-slate-300">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PresenceTracker />

      <div className="min-h-screen bg-[#020617] text-white">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#030712_0%,_#020617_45%,_#061229_100%)]" />
        <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.08]" />

        <SiteHeader />

        <main className="mx-auto w-full max-w-[1800px] px-4 pb-10 sm:px-6 lg:px-8">
          <DailyRewardCard />

          <div className="mt-5">
            <EarnTasksSection />
          </div>

          {/* Integrated Partner Offerwalls Section */}
          <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/60 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">
                  Partner Offerwalls
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Earn JB Coins via Offers & Surveys
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Complete tasks, play games, or answer surveys from our official partners.
                </p>
              </div>

              {/* Provider Switcher Tabs */}
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/80 p-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("cpagrip")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "cpagrip"
                      ? "bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  CPAGrip
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("monlix")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    activeTab === "monlix"
                      ? "bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Monlix
                </button>
              </div>
            </div>

            {/* Offerwall Frame */}
            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-2xl">
              {userId ? (
                <iframe
                  key={activeTab}
                  src={offerwallUrls[activeTab]}
                  className="h-[750px] w-full border-0"
                  title={`${activeTab} offerwall`}
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-400">
                  Loading offerwall...
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </>
  )
}

export default function EarnCoinsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 text-white">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.05] px-6 py-4 text-center font-bold shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            Loading earn coins...
          </div>
        </div>
      }
    >
      <EarnCoinsPageContent />
    </Suspense>
  )
}