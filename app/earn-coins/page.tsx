"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import PresenceTracker from "@/app/components/PresenceTracker"
import SiteHeader from "@/app/components/SiteHeader"
import DailyRewardCard from "@/app/components/DailyRewardCard"

// --- COMBINED MONETAG & ADSTERRA SMARTLINK TASKS ---
const SMARTLINK_TASKS = [
  {
    id: "task-1",
    title: "Quick Visit",
    description: "Bisitahin ang sponsor page nang 15 seconds.",
    reward: 25,
    cooldown: 15,
    url: "https://profitableratecpmnetwork.com/vja5sy3m?key=fc8ea4a621cb34f209a9fa31d4b85bea", // Adsterra Link 1
  },
  {
    id: "task-2",
    title: "Standard Visit",
    description: "Mag-stay sa sponsor page nang 30 seconds para sa mas malaking reward.",
    reward: 60,
    cooldown: 30,
    url: "https://omg10.com/4/11698464", // Monetag Link 1 (Fair Link)
  },
  {
    id: "task-3",
    title: "Premium Visit",
    description: "Kailangan ng extra coins? Maghintay ng 60 seconds sa page na ito.",
    reward: 150,
    cooldown: 60,
    url: "https://profitableratecpmnetwork.com/kvx8tkwni0?key=af8f3ec4f9904d2b3f92245d38b66963", // Adsterra Link 2
  },
]

function EarnCoinsPageContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // --- AD REWARD & MODAL STATES ---
  const [adWatchCount, setAdWatchCount] = useState(0)
  const [showAdModal, setShowAdModal] = useState(false)
  const [cooldown, setCooldown] = useState(15)
  const [claiming, setClaiming] = useState(false)
  const [isTabFocused, setIsTabFocused] = useState(false)
  const [activeTaskReward, setActiveTaskReward] = useState(25)

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("ad_watch_count")
          .eq("id", user.id)
          .maybeSingle()

        if (profile) {
          setAdWatchCount(profile.ad_watch_count || 0)
        }
      } finally {
        setCheckingAuth(false)
      }
    }

    void checkUser()
  }, [router, supabase])

  // --- FOCUS-BASED TIMER ---
  useEffect(() => {
    if (!showAdModal || cooldown <= 0) return

    const interval = setInterval(() => {
      if (document.hidden) {
        setIsTabFocused(true)
        setCooldown((prev) => Math.max(0, prev - 1))
      } else {
        setIsTabFocused(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [showAdModal, cooldown])

  const handleWatchAd = (url: string, reward: number, time: number) => {
    setActiveTaskReward(reward)
    setCooldown(time)
    setIsTabFocused(false)
    setShowAdModal(true)

    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  const handleClaimProgress = async () => {
    if (!userId || claiming) return
    setClaiming(true)

    try {
      const todayStr = new Date().toISOString().split("T")[0]
      const newCount = adWatchCount + 1

      const { data: profile } = await supabase
        .from("profiles")
        .select("coins, ad_watch_count, daily_ad_coins, last_ad_date")
        .eq("id", userId)
        .maybeSingle()

      const currentCoins = profile?.coins || 0
      let dailyAdCoins = profile?.daily_ad_coins || 0
      const lastAdDate = profile?.last_ad_date || ""

      if (lastAdDate !== todayStr) {
        dailyAdCoins = 0
      }

      const DAILY_LIMIT = 2000
      const remainingLimit = Math.max(0, DAILY_LIMIT - dailyAdCoins)
      
      const actualReward = Math.min(activeTaskReward, remainingLimit)
      const newDailyAdCoins = dailyAdCoins + actualReward
      const updatedCoins = currentCoins + actualReward

      await supabase
        .from("profiles")
        .update({ 
          ad_watch_count: newCount,
          coins: updatedCoins,
          daily_ad_coins: newDailyAdCoins,
          last_ad_date: todayStr
        })
        .eq("id", userId)

      if (actualReward > 0) {
        await supabase.from("coin_history").insert({
          user_id: userId,
          amount: actualReward,
          type: "ad_reward",
          description: "Completed SmartLink Task",
        })

        window.dispatchEvent(new CustomEvent("jb-coins-updated", { detail: { reward: actualReward } }))
        alert(`💰 You received ${actualReward} JB Coins!`)
      } else {
        alert(`📺 Task counted! You have reached your daily limit of 2,000 JB Coins. Come back tomorrow!`)
      }

      setAdWatchCount(newCount)
      setShowAdModal(false)
      
    } catch (err) {
      console.error("Error claiming ad:", err)
      alert("Something went wrong. Please try again.")
    } finally {
      setClaiming(false)
    }
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

        <main className="mx-auto w-full max-w-[1800px] px-4 pt-28 pb-10 sm:px-6 lg:px-8">
          <DailyRewardCard />

          {/* USER INSTRUCTION BANNER */}
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-3 text-amber-400">
              <span className="text-lg">💡</span>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Paalala at Instruksyon sa Pag-Watch ng Ads
              </h3>
            </div>

            <ul className="grid gap-3 text-xs font-medium text-amber-100/90 sm:grid-cols-3">
              <li className="rounded-xl border border-amber-500/20 bg-black/40 p-3.5">
                <strong className="block mb-1 text-white text-xs font-bold">1. Maghintay sa Ad Page</strong>
                Kapag nagbukas ang sponsor link (tulad ng <code className="text-amber-300 font-mono">profitableratecpmnetwork.com</code> o <code className="text-amber-300 font-mono font-semibold">omg10.com</code>), manatili roon nang ayon sa segundo ng napili mong task (10s, 15s, 30s, o 60s).
              </li>

              <li className="rounded-xl border border-amber-500/20 bg-black/40 p-3.5">
                <strong className="block mb-1 text-white text-xs font-bold">2. Pwede i-Close / i-Back</strong>
                Kung may ibang ads o extra pop-up page na lumabas, maaari mo na itong i-close o i-back pagkatapos ng itinakdang oras ng countdown.
              </li>

              <li className="rounded-xl border border-amber-500/20 bg-black/40 p-3.5">
                <strong className="block mb-1 text-white text-xs font-bold">3. I-claim ang Coins</strong>
                Bumalik sa tab na ito at i-click ang <strong className="text-emerald-400 font-extrabold">Claim Coins</strong> button kapag natapos na ang timer para pumasok ang reward sa iyong JB Wallet.
              </li>
            </ul>
          </div>

          {/* MAIN UNLIMITED ADS BUTTON (MONETAG CRAZY LINK) */}
          <div className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/60 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Unlimited Earnings
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Watch Ads, Earn Coins
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Earn <strong className="text-amber-400">15 JB Coins</strong> for every ad you watch! (Max 2,000 Coins/day)
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-6 flex flex-col items-center justify-center min-h-[180px]">
              <div className="w-full max-w-md mx-auto text-center">
                <div className="mb-4">
                  <span className="text-5xl">📺</span>
                </div>

                <button
                  onClick={() =>
                    handleWatchAd(
                      "https://omg10.com/4/11743847", // Monetag Link 2 (Crazy Link)
                      15,
                      10
                    )
                  }
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:scale-[1.02] active:scale-95"
                >
                  Watch Ad (+15 Coins)
                </button>
              </div>
            </div>
          </div>

          {/* TIERED SMARTLINK TASKS */}
          <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/60 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">
                  Smart Tasks
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  High Paying Visit Tasks
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Pumili ng task. Mas matagal na pagbisita, mas malaking reward ang makukuha mo.
                </p>
              </div>
            </div>

            <div className="w-full rounded-[24px] border border-white/10 bg-slate-950 p-6">
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {SMARTLINK_TASKS.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-left transition hover:border-sky-500/40 hover:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-sky-400">
                          {task.cooldown}s Timer
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          +{task.reward} Coins
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">{task.title}</h4>
                      <p className="mt-1 text-xs text-slate-400">
                        {task.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleWatchAd(task.url, task.reward, task.cooldown)}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-sky-500/20 transition hover:scale-[1.01] active:scale-95"
                    >
                      Start Task ↗
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* --- DYNAMIC AD VALIDATION MODAL --- */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-white/20 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <button 
              onClick={() => setShowAdModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm font-bold bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full transition"
            >
              ✕ Close
            </button>

            <h3 className="text-xl font-black text-white mt-2">Validating Visit</h3>
            <p className="mt-1 text-xs text-slate-300">
              Please stay on the newly opened tab to claim your reward.
            </p>

            <div className="my-6 flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-slate-950/80 p-6 text-center">
              <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                🌐
              </div>
              <p className="text-sm font-bold text-emerald-400">Sponsor Page Active</p>
              
              {!isTabFocused && cooldown > 0 && (
                <p className="mt-2 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                  ⚠️ Timer paused! Please switch back to the sponsor tab to continue countdown.
                </p>
              )}
            </div>

            {cooldown > 0 ? (
              <div className="w-full rounded-xl bg-slate-800 py-3 text-center text-sm font-bold text-amber-400 border border-amber-500/20">
                Stay on ad tab for {cooldown}s to Claim...
              </div>
            ) : (
              <button
                onClick={handleClaimProgress}
                disabled={claiming}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {claiming ? "Claiming Coins..." : `💰 Claim +${activeTaskReward} Coins Now!`}
              </button>
            )}
          </div>
        </div>
      )}
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