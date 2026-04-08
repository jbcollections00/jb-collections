"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type DailyRewardResponse = {
  ok: boolean
  claimed?: boolean
  alreadyClaimed?: boolean
  coins?: number
  rewardDate?: string
  nextClaimDate?: string
  claimedAt?: string | null
  message?: string
  error?: string
}

type FloatingCoin = {
  id: number
  left: number
  delay: number
  duration: number
  rotate: number
}

const JB_COIN_IMAGE = "/jb-coin.png"

export default function DailyRewardCard() {
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [coins, setCoins] = useState(15)
  const [rewardDate, setRewardDate] = useState("")
  const [nextClaimDate, setNextClaimDate] = useState("")
  const [message, setMessage] = useState("")
  const [showPopup, setShowPopup] = useState(false)
  const [popupDismissed, setPopupDismissed] = useState(false)
  const [showMarquee, setShowMarquee] = useState(false)
  const [burstCoins, setBurstCoins] = useState<FloatingCoin[]>([])
  const [showClaimSuccess, setShowClaimSuccess] = useState(false)

  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current)
      popupTimerRef.current = null
    }

    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
  }, [])

  const createCoinBurst = useCallback((amount: number) => {
    const total = Math.min(Math.max(amount + 5, 8), 18)

    const items: FloatingCoin[] = Array.from({ length: total }).map((_, index) => ({
      id: Date.now() + index,
      left: 8 + Math.random() * 84,
      delay: Math.random() * 0.2,
      duration: 1.6 + Math.random() * 0.9,
      rotate: -30 + Math.random() * 60,
    }))

    setBurstCoins(items)

    window.setTimeout(() => {
      setBurstCoins([])
    }, 2600)
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      clearTimers()
      setLoading(true)
      setMessage("")

      const res = await fetch("/api/rewards/daily", {
        method: "GET",
        cache: "no-store",
      })

      const data: DailyRewardResponse = await res.json()

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to load daily reward.")
        setClaimed(false)
        setShowPopup(false)
        setShowMarquee(false)
        return
      }

      const alreadyClaimed = !!data.claimed
      const rewardCoins = Number(data.coins || 15)

      setClaimed(alreadyClaimed)
      setCoins(rewardCoins)
      setRewardDate(data.rewardDate ?? "")
      setNextClaimDate(data.nextClaimDate ?? "")
      setMessage("")

      if (alreadyClaimed) {
        setShowPopup(false)
        setShowMarquee(false)
        setPopupDismissed(false)
        return
      }

      if (popupDismissed) {
        setShowPopup(false)
        setShowMarquee(true)
        return
      }

      popupTimerRef.current = setTimeout(() => {
        setShowPopup(true)
        setShowMarquee(false)
      }, 700)
    } catch (error) {
      console.error("Daily reward load error:", error)
      setMessage("Failed to load daily reward.")
      setClaimed(false)
      setShowPopup(false)
      setShowMarquee(false)
    } finally {
      setLoading(false)
    }
  }, [clearTimers, popupDismissed])

  useEffect(() => {
    void loadStatus()

    return () => {
      clearTimers()
    }
  }, [loadStatus, clearTimers])

  const closePopup = useCallback(() => {
    setShowPopup(false)
    setPopupDismissed(true)
    if (!claimed) {
      setShowMarquee(true)
    }
  }, [claimed])

  const reopenPopup = useCallback(() => {
    setShowPopup(true)
    setShowMarquee(false)
  }, [])

  const handleClaim = useCallback(async () => {
    try {
      setClaiming(true)
      setMessage("")

      const res = await fetch("/api/rewards/daily", {
        method: "POST",
      })

      const data: DailyRewardResponse = await res.json()

      if (!res.ok || !data.ok) {
        if (data.alreadyClaimed) {
          setClaimed(true)
          setCoins(Number(data.coins || 15))
          setRewardDate(data.rewardDate ?? "")
          setNextClaimDate(data.nextClaimDate ?? "")
          setMessage(data.message || "You already claimed today’s daily reward.")
          setShowPopup(false)
          setShowMarquee(false)
          setPopupDismissed(false)
          return
        }

        setMessage(data.error || data.message || "Failed to claim daily reward.")
        return
      }

      const rewardCoins = Number(data.coins || 15)

      setClaimed(true)
      setCoins(rewardCoins)
      setRewardDate(data.rewardDate ?? "")
      setNextClaimDate(data.nextClaimDate ?? "")
      setMessage(data.message || "Daily reward claimed successfully.")
      setShowPopup(false)
      setShowMarquee(false)
      setPopupDismissed(false)
      setShowClaimSuccess(true)
      createCoinBurst(rewardCoins)

      successTimerRef.current = setTimeout(() => {
        setShowClaimSuccess(false)
      }, 2200)

      window.dispatchEvent(new CustomEvent("jb-coins-updated"))
      window.dispatchEvent(
        new CustomEvent("jb-daily-reward-claimed", {
          detail: {
            coins: rewardCoins,
            rewardDate: data.rewardDate ?? rewardDate,
            nextClaimDate: data.nextClaimDate ?? nextClaimDate,
          },
        })
      )

      window.setTimeout(() => {
        window.location.reload()
      }, 900)
    } catch (error) {
      console.error("Daily reward claim error:", error)
      setMessage("Failed to claim daily reward.")
    } finally {
      setClaiming(false)
    }
  }, [createCoinBurst, nextClaimDate, rewardDate])

  const marqueeText = useMemo(() => {
    return `Claim your daily JB Coins • Claim your daily JB Coins • Claim your daily JB Coins • `
  }, [])

  return (
    <>
      <style jsx>{`
        @keyframes dailyRewardPopupIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes dailyRewardCoinFly {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.7) rotate(0deg);
          }
          15% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-170px) scale(1.15) rotate(360deg);
          }
        }

        @keyframes dailyRewardMarquee {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .daily-reward-popup-in {
          animation: dailyRewardPopupIn 0.28s ease-out;
        }

        .daily-reward-marquee-track {
          white-space: nowrap;
          will-change: transform;
          animation: dailyRewardMarquee 12s linear infinite;
        }
      `}</style>

      {showMarquee && !claimed && !loading ? (
        <button
          type="button"
          onClick={reopenPopup}
          className="mb-6 block w-full overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-yellow-400/10 to-amber-500/10 px-0 py-3 text-left shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm transition hover:border-amber-300/40 hover:bg-amber-500/12"
        >
          <div className="daily-reward-marquee-track text-sm font-bold uppercase tracking-[0.18em] text-amber-300">
            {marqueeText}
          </div>
        </button>
      ) : null}

      {showClaimSuccess ? (
        <div className="pointer-events-none fixed inset-0 z-[210] flex items-center justify-center">
          <div className="rounded-full border border-amber-300/40 bg-slate-950/85 px-5 py-3 text-center shadow-2xl backdrop-blur-md">
            <img
              src={JB_COIN_IMAGE}
              alt="JB Coin"
              className="mx-auto h-10 w-10 object-contain"
            />
            <div className="mt-1 text-sm font-bold text-amber-300">
              +{coins} JB Coins
            </div>
          </div>
        </div>
      ) : null}

      {burstCoins.map((coin) => (
        <div
          key={coin.id}
          className="pointer-events-none fixed bottom-24 z-[215]"
          style={{
            left: `${coin.left}%`,
            animationName: "dailyRewardCoinFly",
            animationDuration: `${coin.duration}s`,
            animationDelay: `${coin.delay}s`,
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
            transform: `rotate(${coin.rotate}deg)`,
          }}
        >
          <img
            src={JB_COIN_IMAGE}
            alt="JB Coin"
            className="h-8 w-8 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
          />
        </div>
      ))}

      {showPopup ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="daily-reward-popup-in relative w-full max-w-md overflow-hidden rounded-[28px] border border-amber-400/25 bg-[linear-gradient(180deg,rgba(30,41,59,0.98),rgba(2,6,23,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
            <button
              type="button"
              onClick={closePopup}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Close
            </button>

            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-amber-400/25 bg-amber-500/10 p-3 shadow-[0_0_35px_rgba(251,191,36,0.18)]">
              <img
                src={JB_COIN_IMAGE}
                alt="JB Coin"
                className="h-full w-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
              />
            </div>

            <div className="mt-5 text-center">
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">
                Daily Bonus
              </div>

              <h3 className="mt-2 text-3xl font-black tracking-tight text-white">
                Claim {coins} JB Coins
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your daily reward is ready. Claim it now and come back again tomorrow
                for more JB Coins.
              </p>

              {message ? (
                <p className="mt-3 text-sm text-rose-400">{message}</p>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closePopup}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                Maybe Later
              </button>

              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming}
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  claiming
                    ? "cursor-not-allowed bg-slate-700 text-slate-300"
                    : "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 hover:brightness-105"
                }`}
              >
                {claiming ? "Claiming..." : `Claim ${coins}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}