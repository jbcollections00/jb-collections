"use client"

import { useEffect, useMemo, useState } from "react"

type ReferralMilestone = {
  referrals: number
  reward: number
  claimed: boolean
  unlocked: boolean
}

type ReferralStats = {
  directReferrals: number
  passiveEarnings: number
  milestoneRewardsClaimed: number
  milestones: ReferralMilestone[]
  nextMilestone: ReferralMilestone | null
}

type ReferralResponse = {
  ok?: boolean
  referralCode?: string
  referralLink?: string
  directReward?: number
  passivePercent?: number
  hasReferrer?: boolean
  stats?: ReferralStats
  error?: string
}

type ActionResponse = {
  ok?: boolean
  message?: string
  error?: string
  reward?: number
}

function getOrigin() {
  if (typeof window === "undefined") return ""
  return window.location.origin
}

export default function ReferralSection() {
  const [referralCode, setReferralCode] = useState("")
  const [referralLink, setReferralLink] = useState("")
  const [inputCode, setInputCode] = useState("")
  const [directReward, setDirectReward] = useState(25)
  const [passivePercent, setPassivePercent] = useState(10)
  const [hasReferrer, setHasReferrer] = useState(false)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const fullReferralLink = useMemo(() => {
    if (!referralLink) return ""
    if (referralLink.startsWith("http")) return referralLink
    return `${getOrigin()}${referralLink}`
  }, [referralLink])

  useEffect(() => {
    void loadReferralInfo()
  }, [])

  async function loadReferralInfo() {
    try {
      setLoading(true)
      setError("")

      const response = await fetch("/api/referrals", {
        method: "GET",
        cache: "no-store",
      })

      const data = (await response.json()) as ReferralResponse

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load referral info.")
      }

      setReferralCode(data.referralCode || "")
      setReferralLink(data.referralLink || "")
      setDirectReward(Number(data.directReward || 25))
      setPassivePercent(Number(data.passivePercent || 10))
      setHasReferrer(Boolean(data.hasReferrer))
      setStats(data.stats || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referral info.")
    } finally {
      setLoading(false)
    }
  }

  async function copyText(value: string) {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Copy failed. Please copy manually.")
    }
  }

  async function applyReferralCode() {
    try {
      setWorking(true)
      setError("")
      setMessage("")

      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          action: "apply",
          code: inputCode,
        }),
      })

      const data = (await response.json()) as ActionResponse

      if (!response.ok) {
        throw new Error(data?.error || "Failed to apply referral code.")
      }

      setMessage(data.message || "Referral code applied.")
      setInputCode("")
      await loadReferralInfo()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply referral code.")
    } finally {
      setWorking(false)
    }
  }

  async function claimMilestone(milestone: ReferralMilestone) {
    try {
      setWorking(true)
      setError("")
      setMessage("")

      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          action: "claim_milestone",
          milestoneCount: milestone.referrals,
        }),
      })

      const data = (await response.json()) as ActionResponse

      if (!response.ok) {
        throw new Error(data?.error || "Failed to claim milestone.")
      }

      setMessage(data.message || `Milestone claimed. +${milestone.reward} JB Coins added.`)

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("jb-coins-updated", {
            detail: {
              reward: Number(data.reward || milestone.reward || 0),
              type: "referral_milestone",
            },
          }),
        )
      }

      await loadReferralInfo()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim milestone.")
    } finally {
      setWorking(false)
    }
  }

  const directReferrals = Number(stats?.directReferrals || 0)
  const passiveEarnings = Number(stats?.passiveEarnings || 0)
  const milestoneRewardsClaimed = Number(stats?.milestoneRewardsClaimed || 0)
  const totalReferralEarnings = passiveEarnings + milestoneRewardsClaimed

  return (
    <section className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200">
            <span>Referral System</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            <span>{passivePercent}% Passive</span>
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Invite friends and earn passively
          </h2>

          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
            Earn {directReward} JB Coins when someone uses your code, then keep earning {passivePercent}% whenever your referred users earn from tasks.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:min-w-[420px]">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-5 py-4 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
              Referrals
            </div>
            <div className="mt-2 text-3xl font-black text-white">{directReferrals}</div>
          </div>

          <div className="rounded-[22px] border border-yellow-400/20 bg-yellow-400/10 px-5 py-4 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-100/80">
              Referral Earned
            </div>
            <div className="mt-2 text-3xl font-black text-yellow-300">
              +{totalReferralEarnings}
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 h-72 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.05]" />
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-5">
            <h3 className="text-xl font-black text-white">Your Invite Code</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Share this code or link with unlimited users. More referrals means more passive earnings.
            </p>

            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/80">
                Code
              </div>
              <div className="mt-2 break-all text-2xl font-black text-cyan-200">
                {referralCode || "Loading..."}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                Link
              </div>
              <div className="mt-2 break-all text-sm font-semibold text-slate-200">
                {fullReferralLink || "Loading..."}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => copyText(referralCode)}
                className="rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
              >
                {copied ? "Copied!" : "Copy Code"}
              </button>

              <button
                type="button"
                onClick={() => copyText(fullReferralLink)}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/[0.1]"
              >
                Copy Link
              </button>
            </div>

            {!hasReferrer ? (
              <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <h4 className="text-sm font-black text-white">Have a referral code?</h4>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  You can apply one referral code only once.
                </p>

                <input
                  value={inputCode}
                  onChange={(event) => setInputCode(event.target.value.toUpperCase())}
                  placeholder="Enter referral code"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
                />

                <button
                  type="button"
                  onClick={applyReferralCode}
                  disabled={working || !inputCode.trim()}
                  className="mt-3 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {working ? "Applying..." : "Apply Code"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-[22px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                You already joined through a referral code.
              </div>
            )}
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Referral Milestones</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Claim bigger rewards as your referral network grows. No referral cap.
                </p>
              </div>

              <div className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 text-xs font-black text-yellow-200">
                Passive: +{passivePercent}%
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {(stats?.milestones || []).map((milestone) => {
                const progress = Math.min(100, Math.round((directReferrals / milestone.referrals) * 100))

                return (
                  <div key={milestone.referrals} className="rounded-[22px] border border-white/10 bg-slate-950/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">
                          Refer {milestone.referrals} users
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Progress: {directReferrals}/{milestone.referrals}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-black text-yellow-300">
                          +{milestone.reward} JB
                        </div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {milestone.claimed ? "Claimed" : milestone.unlocked ? "Unlocked" : "Locked"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 transition-all"
                        style={{ width: `${Math.max(5, progress)}%` }}
                      />
                    </div>

                    {milestone.unlocked && !milestone.claimed ? (
                      <button
                        type="button"
                        onClick={() => claimMilestone(milestone)}
                        disabled={working}
                        className="mt-3 w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Claim Milestone
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
