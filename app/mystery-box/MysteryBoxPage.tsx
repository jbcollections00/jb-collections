"use client"

import SiteHeader from "../components/SiteHeader"
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

      window.dispatchEvent(
        new CustomEvent("jb-coins-updated", {
          detail: { reward: data.reward },
        })
      )
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SiteHeader />

      <main className="min-h-[calc(100vh-104px)] px-6 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-4 text-4xl font-black text-white">
            🎁 Mystery Box
          </h1>

          <p className="mb-8 text-lg text-gray-400">
            Open once per day and win random coins!
          </p>

          <button
            onClick={openBox}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Opening..." : "Open Mystery Box"}
          </button>

          {reward && (
            <div className="mt-8 text-2xl font-bold text-green-400 animate-pulse">
              🎉 You won {reward} JB Coins!
            </div>
          )}

          {error && (
            <div className="mt-8 text-xl font-semibold text-red-400">
              {error}
            </div>
          )}
        </div>
      </main>
    </>
  )
}