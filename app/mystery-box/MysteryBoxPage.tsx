"use client"

import { useState } from "react"

export default function MysteryBoxPage() {
  const [loading, setLoading] = useState(false)
  const [reward, setReward] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openBox = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/mystery-box/open", {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      setReward(data.reward)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 text-center">
      <h1 className="text-3xl font-bold mb-4">🎁 Mystery Box</h1>

      <p className="mb-6 text-gray-400">
        Open once per day and win random coins!
      </p>

      <button
        onClick={openBox}
        disabled={loading}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold"
      >
        {loading ? "Opening..." : "Open Mystery Box"}
      </button>

      {reward && (
        <div className="mt-6 text-green-400 text-xl font-bold animate-pulse">
          🎉 You won {reward} JB Coins!
        </div>
      )}

      {error && (
        <div className="mt-6 text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}