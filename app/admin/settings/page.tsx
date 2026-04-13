"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Coins,
  Gift,
  Lock,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react"
import SiteHeader from "@/app/components/SiteHeader"

type SettingsMap = Record<string, string>

type SettingsResponse = {
  settings: SettingsMap
}

type SaveResponse = {
  ok: boolean
  settings: SettingsMap
}

const DEFAULT_SETTINGS: SettingsMap = {
  premium_unlock_cost: "2000",
  platinum_unlock_cost: "2600",
  daily_reward: "25",
  signup_reward: "35",
  referral_reward: "25",
  message_cost: "10",
  profile_boost_cost: "50",
  featured_upload_cost: "100",
  minimum_cashout_coins: "5000",
  coin_packages_json: JSON.stringify(
    [
      {
        id: "starter",
        label: "Starter Pack",
        amount: 99,
        base: 200,
        bonus: 25,
        featured: false,
      },
      {
        id: "popular",
        label: "Popular Pack",
        amount: 299,
        base: 700,
        bonus: 100,
        featured: true,
      },
      {
        id: "power",
        label: "Power Pack",
        amount: 499,
        base: 1100,
        bonus: 200,
        featured: false,
      },
    ],
    null,
    2
  ),
}

function toNumberString(value: string) {
  const cleaned = value.replace(/[^\d]/g, "")
  return cleaned
}

function prettyLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function NumberSettingCard(props: {
  icon: React.ReactNode
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  suffix?: string
}) {
  const { icon, title, description, value, onChange, suffix } = props

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sky-200">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Current Value
          </div>
          <div className="flex items-center gap-3">
            <input
              value={value}
              onChange={(event) => onChange(toNumberString(event.target.value))}
              inputMode="numeric"
              className="w-full bg-transparent text-2xl font-black text-white outline-none placeholder:text-slate-600"
              placeholder="0"
            />
            {suffix ? (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                {suffix}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function loadSettings() {
    try {
      setIsLoading(true)
      setError("")
      setSuccess("")

      const res = await fetch("/api/admin/settings", {
        method: "GET",
        cache: "no-store",
      })

      const data = (await res.json().catch(() => null)) as SettingsResponse | null

      if (!res.ok || !data?.settings) {
        throw new Error("Failed to load admin settings.")
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...data.settings,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin settings.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(""), 2400)
    return () => window.clearTimeout(timer)
  }, [success])

  const parsedPackages = useMemo(() => {
    try {
      const parsed = JSON.parse(settings.coin_packages_json || "[]")
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return null
    }
  }, [settings.coin_packages_json])

  function updateSetting(key: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      setError("")
      setSuccess("")

      try {
        const parsed = JSON.parse(settings.coin_packages_json || "[]")
        if (!Array.isArray(parsed)) {
          throw new Error("Coin packages JSON must be an array.")
        }
      } catch {
        throw new Error("Coin packages JSON is invalid. Please fix it before saving.")
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings }),
      })

      const data = (await res.json().catch(() => null)) as SaveResponse | null

      if (!res.ok || !data?.ok) {
        throw new Error("Failed to save admin settings.")
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...data.settings,
      })
      setSuccess("Settings saved successfully.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_22%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_18%),linear-gradient(180deg,#020617_0%,#071124_48%,#0f172a_100%)] px-3 pb-12 pt-24 text-white sm:px-4 lg:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Back to Admin
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200">
              <Settings2 size={14} />
              Wallet + Rewards + Pricing Control
            </div>
          </div>

          <section className="rounded-[30px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)] backdrop-blur sm:p-6 lg:p-8">
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                  <ShieldCheck size={14} />
                  Full Admin Control
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Admin Wallet Settings
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Manage wallet prices, unlock costs, rewards, feature costs, and top-up
                  package data from one admin page. These values are pulled from the
                  database so you can update the platform without editing frontend code.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
                    <WalletCards size={16} className="text-sky-200" />
                    Wallet pricing
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
                    <Gift size={16} className="text-emerald-200" />
                    Rewards system
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
                    <Coins size={16} className="text-amber-200" />
                    Coin package JSON
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Settings Loaded
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {isLoading ? "Loading..." : `${Object.keys(settings).length} keys`}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Admin-controlled values stored in database
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Package Entries
                  </div>
                  <div className="mt-2 text-xl font-black text-amber-300">
                    {parsedPackages ? parsedPackages.length : "Invalid JSON"}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Wallet top-up packages ready for storefront use
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div className="mt-5 rounded-[24px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-5 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadSettings()}
              disabled={isLoading || isSaving}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Refresh Settings
            </button>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isLoading || isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {isSaving ? "Saving..." : "Save All Settings"}
            </button>
          </div>

          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                  <Lock size={16} />
                  Membership Unlock Pricing
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <NumberSettingCard
                    icon={<Sparkles size={18} />}
                    title="Premium Unlock Cost"
                    description="Coins required to unlock Premium."
                    value={settings.premium_unlock_cost || ""}
                    onChange={(value) => updateSetting("premium_unlock_cost", value)}
                    suffix="Coins"
                  />

                  <NumberSettingCard
                    icon={<Sparkles size={18} />}
                    title="Platinum Unlock Cost"
                    description="Coins required to unlock Platinum."
                    value={settings.platinum_unlock_cost || ""}
                    onChange={(value) => updateSetting("platinum_unlock_cost", value)}
                    suffix="Coins"
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                  <Gift size={16} />
                  Rewards Management
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <NumberSettingCard
                    icon={<Gift size={18} />}
                    title="Daily Reward"
                    description="Coins added for daily reward claim."
                    value={settings.daily_reward || ""}
                    onChange={(value) => updateSetting("daily_reward", value)}
                    suffix="Coins"
                  />

                  <NumberSettingCard
                    icon={<Gift size={18} />}
                    title="Signup Reward"
                    description="Coins granted after successful signup."
                    value={settings.signup_reward || ""}
                    onChange={(value) => updateSetting("signup_reward", value)}
                    suffix="Coins"
                  />

                  <NumberSettingCard
                    icon={<Gift size={18} />}
                    title="Referral Reward"
                    description="Coins granted to the referrer."
                    value={settings.referral_reward || ""}
                    onChange={(value) => updateSetting("referral_reward", value)}
                    suffix="Coins"
                  />

                  <NumberSettingCard
                    icon={<Gift size={18} />}
                    title="Minimum Cashout Coins"
                    description="Minimum coins required before cashout or withdrawal."
                    value={settings.minimum_cashout_coins || ""}
                    onChange={(value) => updateSetting("minimum_cashout_coins", value)}
                    suffix="Coins"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                  <Coins size={16} />
                  Feature Coin Costs
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <NumberSettingCard
                    icon={<Coins size={18} />}
                    title="Message Cost"
                    description="Coins deducted per paid message action."
                    value={settings.message_cost || ""}
                    onChange={(value) => updateSetting("message_cost", value)}
                    suffix="Coins"
                  />

                  <NumberSettingCard
                    icon={<Coins size={18} />}
                    title="Profile Boost Cost"
                    description="Coins required for one profile boost action."
                    value={settings.profile_boost_cost || ""}
                    onChange={(value) => updateSetting("profile_boost_cost", value)}
                    suffix="Coins"
                  />

                  <NumberSettingCard
                    icon={<Coins size={18} />}
                    title="Featured Upload Cost"
                    description="Coins required to feature an upload."
                    value={settings.featured_upload_cost || ""}
                    onChange={(value) => updateSetting("featured_upload_cost", value)}
                    suffix="Coins"
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                  <WalletCards size={16} />
                  Coin Packages JSON
                </div>

                <p className="mb-4 text-sm leading-6 text-slate-400">
                  Edit your wallet top-up plans here. This JSON can power your upgrade page,
                  checkout page, and admin package editor.
                </p>

                <textarea
                  value={settings.coin_packages_json || ""}
                  onChange={(event) => updateSetting("coin_packages_json", event.target.value)}
                  rows={22}
                  spellCheck={false}
                  className="w-full rounded-[24px] border border-white/10 bg-slate-950/70 px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
                />

                <div className="mt-4 rounded-[22px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Preview Keys
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.keys(settings).map((key) => (
                      <span
                        key={key}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300"
                      >
                        {prettyLabel(key)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
              <ShieldCheck size={16} />
              Storefront Package Preview
            </div>

            {parsedPackages ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {parsedPackages.map((item: any, index: number) => {
                  const amount = Number(item?.amount || 0)
                  const base = Number(item?.base || 0)
                  const bonus = Number(item?.bonus || 0)
                  const total = base + bonus
                  return (
                    <div
                      key={item?.id || index}
                      className={`rounded-[24px] border p-5 shadow-[0_16px_40px_rgba(0,0,0,0.26)] ${
                        item?.featured
                          ? "border-amber-400/20 bg-amber-400/10"
                          : "border-white/10 bg-slate-950/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-lg font-black text-white">
                          {item?.label || "Unnamed Package"}
                        </div>
                        {item?.featured ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
                            Featured
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        <div className="flex items-center justify-between gap-3">
                          <span>Payment</span>
                          <span className="font-black text-amber-300">₱{amount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Base Coins</span>
                          <span className="font-black text-white">{base.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Bonus Coins</span>
                          <span className="font-black text-emerald-300">+{bonus.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
                          <span>Total Coins</span>
                          <span className="font-black text-white">{total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Coin packages JSON is invalid. Fix the JSON before saving.
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
