"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import PresenceTracker from "@/app/components/PresenceTracker"
import SiteHeader from "@/app/components/SiteHeader"
import DailyRewardCard from "@/app/components/DailyRewardCard"
import EarnTasksSection from "@/app/components/EarnTasksSection"

type OfferwallProvider = "cpagrip" | "torox" | "cpx" | "lootably" | "monlix"

interface ProviderConfig {
  id: OfferwallProvider
  label: string
  badge?: string
}

const PROVIDERS: ProviderConfig[] = [
  { id: "cpagrip", label: "CPAGrip", badge: "Recommended" },
  { id: "torox", label: "Torox", badge: "High Payout" },
  { id: "cpx", label: "CPX Surveys", badge: "Top Surveys" },
  { id: "lootably", label: "Lootably" },
  { id: "monlix", label: "Monlix" },
]

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

  // Offerwall URLs configured with user ID tracking
  // Note: Using passworddomain.com for CPAGrip to bypass common adblockers
  const offerwallUrls: Record<OfferwallProvider, string> = {
    cpagrip: `https://passworddomain.com/show.php?l=0&u=2546994&id=1907578&tracking_id=${userId || ""}`,
    torox: `https://offerwall.torox.io/YOUR_TOROX_APP_ID/${userId || ""}`,
    cpx: `https://offers.cpx-research.com/index.php?app_id=35034&ext_user_id=${userId || ""}`,
    lootably: `https://lootably.com/gifting-wall/YOUR_LOOTABLY_PLACEMENT_ID?uid=${userId || ""}`,
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

              {/* Provider Switcher Tabs (Responsive Scrollable) */}
              <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 p-1.5 scrollbar-none">
                {PROVIDERS.map((provider) => {
                  const isActive = activeTab === provider.id
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setActiveTab(provider.id)}
                      className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-md shadow-sky-500/20"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {provider.label}
                      {provider.badge && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {provider.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Offerwall Frame */}
            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950 shadow-2xl relative min-h-[800px]">
              {userId ? (
                <iframe
                  key={activeTab}
                  src={offerwallUrls[activeTab]}
                  className="absolute inset-0 h-full w-full border-0 bg-slate-950"
                  title={`${activeTab} offerwall`}
                  allow="geolocation; microphone; camera; clipboard-write"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
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