import { createClient } from "@/lib/supabase-server"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface LeaderboardUser {
  user_id: string
  username: string
  total: number
}

function aggregateData(data: any[]): LeaderboardUser[] {
  if (!data || data.length === 0) return []
  const totals: Record<string, LeaderboardUser> = {}

  data.forEach((row) => {
    const userId = row.user_id
    if (!userId) return

    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const username = profile?.username || "Anonymous"

    if (!totals[userId]) {
      totals[userId] = { user_id: userId, username, total: 0 }
    }
    totals[userId].total += 1 // 1 count per download
  })

  return Object.values(totals).sort((a, b) => b.total - a.total)
}

export default async function DownloadersLeaderboardPage() {
  const supabase = await createClient()

  // --- DATE COMPUTATION (Manila Time) ---
  const now = new Date()
  const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
  const dayOfWeek = manilaNow.getDay()
  const diffToCurrentMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  
  const startOfCurrentWeek = new Date(manilaNow)
  startOfCurrentWeek.setDate(manilaNow.getDate() - diffToCurrentMonday)
  startOfCurrentWeek.setHours(0, 0, 0, 0)
  
  const startOfLastWeek = new Date(startOfCurrentWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  const formatISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const date = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${date}T00:00:00+08:00`
  }

  const currentStartIso = new Date(formatISO(startOfCurrentWeek)).toISOString()
  const lastStartIso = new Date(formatISO(startOfLastWeek)).toISOString()

  // --- FETCH DATA ---
  const [currentRes, lastRes] = await Promise.all([
    supabase
      .from("download_logs")
      .select("user_id, profiles(username)")
      .gte("created_at", currentStartIso),
    supabase
      .from("download_logs")
      .select("user_id, profiles(username)")
      .gte("created_at", lastStartIso)
      .lt("created_at", currentStartIso)
  ])

  const currentList = aggregateData(currentRes.data || []).slice(0, 10)
  const lastWeekList = aggregateData(lastRes.data || []).slice(0, 3)

  const [top1, top2, top3] = lastWeekList

  return (
    <div className="flex justify-center p-4 sm:p-6 min-h-screen bg-slate-950 text-white">
      <div className="w-full max-w-lg p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl h-fit">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            🏆 Weekly Hall of Fame
          </h2>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl mb-5 border border-slate-700/50">
          <Link
            href="/leaderboard/downloaders"
            className="flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 shadow-md transition-all"
          >
            📥 Top Downloaders
          </Link>
          <Link
            href="/leaderboard/coins"
            className="flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition-all"
          >
            🪙 Top Coin Earners
          </Link>
        </div>

        {/* Podium (Last Week) */}
        {lastWeekList.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-b from-amber-500/20 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl text-center shadow-inner">
            <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-widest mb-4 flex items-center justify-center gap-1.5">
              🎉 Last Week's Champions 🎉
            </h3>
            <div className="grid grid-cols-3 gap-2 items-end">
              {top2 ? <PodiumCard rank={2} user={top2} suffix="DLs" /> : <div />}
              {top1 ? <PodiumCard rank={1} user={top1} suffix="DLs" /> : <div />}
              {top3 ? <PodiumCard rank={3} user={top3} suffix="DLs" /> : <div />}
            </div>
          </div>
        )}

        {/* Current List */}
        <h3 className="text-sm font-semibold text-slate-300 mb-3 px-1">🔥 Current Live Standings</h3>
        {currentList.length > 0 ? (
          <div className="space-y-2.5">
            {currentList.map((user, i) => (
              <ListCard key={user.user_id} rank={i + 1} user={user} suffix="downloads" />
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-slate-400 text-sm">Wala pang records ngayong linggo.</p>
        )}
      </div>
    </div>
  )
}

// --- REUSABLE COMPONENTS PARA PUMALIIT ANG CODE ---
function PodiumCard({ rank, user, suffix }: { rank: number; user: LeaderboardUser; suffix: string }) {
  const isGold = rank === 1
  return (
    <div className={`flex flex-col items-center p-2.5 rounded-xl relative shadow-md ${isGold ? "bg-slate-800 border-2 border-amber-400 -mt-3 p-3 shadow-xl shadow-amber-500/20" : "bg-slate-800/90 border border-slate-500/40"}`}>
      {isGold && <span className="absolute -top-3 text-base">👑</span>}
      <span className={`${isGold ? "text-2xl" : "text-xl"} mb-1 mt-0.5`}>{isGold ? "🥇" : rank === 2 ? "🥈" : "🥉"}</span>
      <span className={`text-xs font-bold truncate w-full ${isGold ? "text-amber-300 font-black" : "text-slate-200"}`}>{user.username}</span>
      <span className="text-[10px] font-extrabold text-amber-400 mt-1">{user.total} {suffix}</span>
      <span className={`mt-1.5 px-2 py-0.5 text-[9px] font-bold rounded-full ${isGold ? "bg-amber-500 text-slate-950" : "bg-slate-700 text-slate-300 border border-slate-600"}`}>
        {isGold ? "Platinum (1 Wk)" : "Premium (1 Wk)"}
      </span>
    </div>
  )
}

function ListCard({ rank, user, suffix }: { rank: number; user: LeaderboardUser; suffix: string }) {
  const badge = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`
  return (
    <div className={`flex items-center justify-between p-3.5 border rounded-xl transition-all ${rank <= 3 ? "bg-slate-800/80 border-slate-700/80" : "bg-slate-800/40 border-slate-700/40"}`}>
      <div className="flex items-center gap-3 truncate">
        <span className="w-7 text-center font-bold text-lg text-slate-400 shrink-0">{badge}</span>
        <span className="font-semibold text-slate-200 text-sm truncate">{user.username}</span>
      </div>
      <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full shrink-0">
        {user.total} {suffix}
      </span>
    </div>
  )
}