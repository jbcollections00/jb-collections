"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import PresenceTracker from "@/app/components/PresenceTracker"
import SiteHeader from "@/app/components/SiteHeader"
import DailyRewardCard from "@/app/components/DailyRewardCard"

// Declare Monetag global window object for TypeScript safety
declare global {
  interface Window {
    show_11699131?: ((format?: string | object) => Promise<void>) & ((options: object) => void)
  }
}

type OfferwallProvider = "cpagrip" | "cpx"

interface ProviderConfig {
  id: OfferwallProvider
  label: string
  badge?: string
}

const PROVIDERS: ProviderConfig[] = [
  { id: "cpagrip", label: "CPAGrip", badge: "Recommended" },
  { id: "cpx", label: "CPX Surveys", badge: "Top Surveys" },
]

function EarnCoinsPageContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OfferwallProvider>("cpagrip")

  // --- AD REWARD STATES ---
  const [adWatchCount, setAdWatchCount] = useState(0)
  const [isWatching, setIsWatching] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [claiming, setClaiming] = useState(false)

  // Array of Direct CPM Links for rotation or fallback
  const AD_LINKS = [
    "https://www.profitableratecpmnetwork.com/pyuze51wkf?key=089f5accce969646a828061bc3a846f2",
    "https://www.profitableratecpmnetwork.com/tw8ajp18mf?key=786d474da794ee7cd3596da3aab40fcc",
    "https://www.profitableratecpmnetwork.com/kvx8tkwni0?key=af8f3ec4f9904d2b3f92245d38b66963",
    "https://www.profitableratecpmnetwork.com/ek44eeb04?key=99f05c43be188cef9d877a7519d8166a",
    "https://omg10.com/4/11698464"
  ]

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

  // --- MONETAG IN-APP INTERSTITIAL INITIALIZATION ---
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.show_11699131 === "function") {
      try {
        window.show_11699131({
          type: 'inApp',
          inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
          }
        })
      } catch (err) {
        console.error("Failed to initialize Monetag In-App ad:", err)
      }
    }
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isWatching && cooldown > 0) {
      interval = setInterval(() => setCooldown((prev) => prev - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [isWatching, cooldown])

  // --- MONETAG REWARDED POPUP / FALLBACK WATCH LOGIC ---
  const handleWatchAd = () => {
    setIsWatching(true)
    setCooldown(5) // Set to 5 seconds cooldown

    if (typeof window !== "undefined" && typeof window.show_11699131 === "function") {
      window.show_11699131('pop')
        .then(() => {
          console.log("Monetag Rewarded Ad completed successfully")
        })
        .catch((e) => {
          console.warn("Monetag Ad error/closed, launching direct link fallback:", e)
          const randomLink = AD_LINKS[Math.floor(Math.random() * AD_LINKS.length)]
          window.open(randomLink, "_blank")
        })
    } else {
      // Fallback kung hindi nakakonekta ang script
      const randomLink = AD_LINKS[Math.floor(Math.random() * AD_LINKS.length)]
      window.open(randomLink, "_blank")
    }
  }

  const handleClaimProgress = async () => {
    if (!userId || claiming) return
    setClaiming(true)

    try {
      const todayStr = new Date().toISOString().split('T')[0] // Formats as YYYY-MM-DD
      const newCount = adWatchCount + 1

      // Fixed reward of 15 coins per ad watched
      const intendedReward = 15

      // 1. Fetch current profile data
      const { data: profile } = await supabase
        .from("profiles")
        .select("coins, ad_watch_count, daily_ad_coins, last_ad_date")
        .eq("id", userId)
        .single()

      const currentCoins = profile?.coins || 0
      let dailyAdCoins = profile?.daily_ad_coins || 0
      const lastAdDate = profile?.last_ad_date || ""

      // 2. Check Daily Reset Condition
      if (lastAdDate !== todayStr) {
        dailyAdCoins = 0 // Reset threshold if it's a new day
      }

      // 3. Determine if user has reached the 2000 coins daily limit
      const DAILY_LIMIT = 2000
      const remainingLimit = Math.max(0, DAILY_LIMIT - dailyAdCoins)
      
      // Calculate actual coins to give (cap at remaining limit)
      const actualReward = Math.min(intendedReward, remainingLimit)
      const newDailyAdCoins = dailyAdCoins + actualReward
      const updatedCoins = currentCoins + actualReward

      // 4. Update Database (Always update ad_watch_count)
      await supabase
        .from("profiles")
        .update({ 
          ad_watch_count: newCount,
          coins: updatedCoins,
          daily_ad_coins: newDailyAdCoins,
          last_ad_date: todayStr
        })
        .eq("id", userId)

      // 5. Log transaction only if actual coins were granted
      if (actualReward > 0) {
        await supabase.from("coin_history").insert({
          user_id: userId,
          amount: actualReward,
          type: "ad_reward",
          description: "Watched an Ad",
        })

        window.dispatchEvent(new CustomEvent("jb-coins-updated", { detail: { reward: actualReward } }))
        
        alert(`💰 You received ${actualReward} JB Coins!`)
      } else {
        // Reached 2000 limit alert
        alert(`📺 Ad counted! You have reached your daily limit of 2,000 JB Coins. Come back tomorrow for more coins!`)
      }

      setAdWatchCount(newCount)
      setIsWatching(false)
      
    } catch (err) {
      console.error("Error claiming ad:", err)
      alert("Something went wrong. Please try again.")
    } finally {
      setClaiming(false)
    }
  }

  const offerwallUrls: Record<OfferwallProvider, string> = {
    cpagrip: `https://www.cpagrip.com/show.php?l=0&u=2546994&id=1907578&tracking_id=${userId || ""}`,
    cpx: `https://offers.cpx-research.com/index.php?app_id=35034&ext_user_id=${userId || ""}`,
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

                {!isWatching ? (
                  <button
                    onClick={handleWatchAd}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:scale-[1.02] active:scale-95"
                  >
                    Watch Ad (+15 Coins)
                  </button>
                ) : (
                  <button
                    onClick={handleClaimProgress}
                    disabled={cooldown > 0 || claiming}
                    className={`w-full rounded-xl px-6 py-4 text-sm font-black text-white transition ${
                      cooldown > 0 
                      ? "bg-slate-700 cursor-not-allowed opacity-70" 
                      : "bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
                    }`}
                  >
                    {cooldown > 0 ? `Wait ${cooldown}s to Claim...` : claiming ? "Claiming..." : "Claim Coins!"}
                  </button>
                )}
              </div>
            </div>
          </div>

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