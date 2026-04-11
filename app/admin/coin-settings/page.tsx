"use client"

import { useEffect, useState } from "react"
import AdminHeader from "@/app/components/AdminHeader"

type Setting = {
  key: string
  value_integer: number
  label: string | null
  description: string | null
}

export default function CoinSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadSettings() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/coin-settings", {
        method: "GET",
        cache: "no-store",
      })

      const data = await res.json()

      if (res.ok) {
        setSettings(data.settings || [])
      }
    } catch (err) {
      console.error("Failed to load settings:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  function updateValue(key: string, value: number) {
    setSettings((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, value_integer: value } : item
      )
    )
  }

  async function saveSettings() {
    setSaving(true)

    try {
      const res = await fetch("/api/admin/coin-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: settings.map((s) => ({
            key: s.key,
            value_integer: s.value_integer,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || "Failed to save")
        return
      }

      alert("✅ JB Coin settings updated!")
      loadSettings()
    } catch (err) {
      console.error("Save error:", err)
      alert("Error saving settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <AdminHeader />

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black mb-2">
            🪙 JB Coin System Settings
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Control rewards, streak bonuses, and coin costs globally.
          </p>

          {loading ? (
            <p>Loading settings...</p>
          ) : (
            <div className="space-y-4">
              {settings.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col gap-2 border rounded-xl p-4"
                >
                  <div className="font-bold text-slate-800">
                    {item.label || item.key}
                  </div>

                  {item.description && (
                    <div className="text-xs text-slate-500">
                      {item.description}
                    </div>
                  )}

                  <input
                    type="number"
                    value={item.value_integer}
                    onChange={(e) =>
                      updateValue(item.key, Number(e.target.value))
                    }
                    className="mt-2 w-full rounded-lg border px-3 py-2"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={saveSettings}
            disabled={saving}
            className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 transition"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  )
}