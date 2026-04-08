"use client"

import { useEffect, useState } from "react"

type LeaderboardUser = {
  user_id: string
  total_coins: number
  profiles?: {
    username?: string
    full_name?: string
  }
}

export default function WeeklyLeaderboard() {
  const [data, setData] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/leaderboard/weekly")
      const json = await res.json()

      if (json.success) {
        setData(json.leaderboard)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()

    // auto refresh every 10s
    const interval = setInterval(fetchLeaderboard, 10000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold mb-4">
        🏆 Weekly Leaderboard
      </h2>

      {loading ? (
        <p>Loading...</p>
      ) : data.length === 0 ? (
        <p>No data yet.</p>
      ) : (
        <div className="space-y-3">
          {data.map((user, index) => {
            const name =
              user.profiles?.username ||
              user.profiles?.full_name ||
              "Unknown"

            return (
              <div
                key={user.user_id}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  index === 0
                    ? "bg-yellow-500 text-black"
                    : index === 1
                    ? "bg-gray-300 text-black"
                    : index === 2
                    ? "bg-orange-400 text-black"
                    : "bg-gray-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">
                    #{index + 1}
                  </span>

                  <span className="font-semibold">
                    {name}
                  </span>
                </div>

                <div className="font-bold">
                  {user.total_coins} JB Coins
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}