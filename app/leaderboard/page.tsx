"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type UserProfile = {
  id: string
  full_name?: string | null
  name?: string | null
  username?: string | null
  avatar_url?: string | null
}

type LeaderboardEntry = {
  rank: number
  id: string
  display_name: string
  username?: string | null
  avatar_url?: string | null
  initials?: string
  coins: number
  membership?: string
  membership_label?: string
  is_current_user?: boolean
}

type LeaderboardResponse = {
  ok?: boolean
  top?: LeaderboardEntry[]
  me?: LeaderboardEntry | null
  error?: string
}

function getInitials(name: string) {
  const cleaned = name.trim()
  if (!cleaned) return "U"

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}

export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true)
        setError("")

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, full_name, name, username, avatar_url")
            .eq("id", user.id)
            .maybeSingle()

          if (profileData) {
            setProfile(profileData as UserProfile)
          }
        }

        const response = await fetch("/api/leaderboard", {
          method: "GET",
          cache: "no-store",
        })

        const text = await response.text()
        const data = (text ? JSON.parse(text) : {}) as LeaderboardResponse

        if (!response.ok) {
          setError(data.error || "Failed to load leaderboard.")
          return
        }

        setLeaderboard(Array.isArray(data.top) ? data.top : [])
        setMyRank(data.me || null)
      } catch (err) {
        console.error("Leaderboard page error:", err)
        setError("Something went wrong while loading the leaderboard.")
      } finally {
        setLoading(false)
      }
    }

    void loadPage()
  }, [supabase])

  return (
    <div className="relative min-h-screen bg-[#050814] text-white">
      {/* Sticky Header with Z-Index Priority */}
      <div className="sticky top-0 z-50">
        <SiteHeader />
      </div>

      {/* Main Page Content */}
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-12 pt-4 sm:pt-6">
        
        {/* Banner Section */}
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#020617_100%)] p-6 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                Leaderboard
              </p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                Top JB Coin Holders
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                View the highest JB Coin holders in one clean page.
              </p>
            </div>

            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Back to Profile
            </Link>
          </div>
        </section>

        {/* Error Alert */}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {error}
          </div>
        ) : null}

        {/* Current User Rank Card */}
        {myRank ? (
          <section className="mt-6 rounded-[28px] border border-yellow-400/20 bg-[linear-gradient(135deg,rgba(250,204,21,0.10),rgba(234,179,8,0.06),rgba(15,23,42,0.95))] p-5 shadow-md ring-1 ring-yellow-400/10">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">
              Your Rank
            </p>

            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-2xl font-black text-white">
                  #{myRank.rank} {myRank.display_name}
                </p>
                <p className="mt-1 text-sm font-semibold text-yellow-200">
                  {myRank.coins.toLocaleString()} JB Coins
                </p>
              </div>

              <div className="rounded-full bg-yellow-400 px-4 py-2 text-xs font-black text-slate-950 shadow">
                YOU
              </div>
            </div>
          </section>
        ) : null}

        {/* Leaderboard List */}
        <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-xl ring-1 ring-white/5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-2xl border border-white/10 bg-slate-950/60"
                />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm font-medium text-slate-400">
              No leaderboard data yet.
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry) => {
                const isCurrentUser =
                  entry.is_current_user ||
                  (profile?.id ? entry.id === profile.id : false)

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-4 rounded-[24px] border px-4 py-4 transition-all duration-200 ${
                      isCurrentUser
                        ? "border-yellow-400/40 bg-yellow-500/10 shadow-lg ring-1 ring-yellow-400/20"
                        : "border-white/10 bg-slate-950/80 hover:border-white/20"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-sm font-black text-white ring-1 ring-white/10">
                        {entry.avatar_url ? (
                          <img
                            src={entry.avatar_url}
                            alt={entry.display_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{entry.initials || getInitials(entry.display_name)}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white sm:text-lg">
                          #{entry.rank} {entry.display_name}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-400 sm:text-sm">
                          {entry.username
                            ? `@${entry.username}`
                            : entry.membership_label || "User"}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xl font-black text-yellow-300 sm:text-2xl">
                        {Number(entry.coins || 0).toLocaleString()}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        JB Coins
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}