"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { ShieldAlert, BadgeAlert, ArrowRight, X } from "lucide-react"

export default function EnterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextPath = searchParams?.get("next") || "/"

  function accept() {
    document.cookie =
      "site_entered=true; path=/; max-age=31536000; SameSite=Lax"
    router.replace(nextPath)
  }

  function leave() {
    window.location.href = "https://google.com"
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_30%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-neutral-300">
                <ShieldAlert className="h-4 w-4" />
                Restricted Access
              </div>

              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
                You are about to enter a website that contains{" "}
                <span className="text-neutral-300">adult content</span>.
              </h1>

              <p className="mt-6 max-w-3xl text-sm leading-7 text-neutral-300 sm:text-base">
                This website is intended only for visitors who are at least{" "}
                <span className="font-semibold text-white">18 years old</span>,
                or the age of legal majority in their jurisdiction, whichever is
                higher. By continuing, you confirm that viewing this material is
                legal where you are accessing it and that no minors will be
                allowed to view this site through your device or connection.
              </p>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-400 sm:text-base">
                <span className="font-semibold text-neutral-200">
                  Parents and guardians:
                </span>{" "}
                you are responsible for restricting access to age-restricted
                material. Please use device controls, filters, or parental tools
                where appropriate.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={accept}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:scale-[1.01] hover:opacity-95"
                >
                  I am 18+ — Enter Site
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={leave}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-neutral-200 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                  Exit Site
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  Adults only
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  Legal age required
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  JB COLLECTIONS
                </span>
              </div>
            </div>

            <div className="relative p-7 sm:p-10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />

              <div className="relative">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-neutral-300">
                  <BadgeAlert className="h-4 w-4" />
                  Notice
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/30 p-6">
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
                        Before entering, you confirm that:
                      </h2>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-200">
                        You are at least{" "}
                        <span className="font-semibold text-white">18 years old</span>.
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-200">
                        You understand the nature of the material available on
                        this website.
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-200">
                        Access to this content is legal in your country, state,
                        province, or region.
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-200">
                        You will not share access with minors.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-neutral-400">
                      By clicking{" "}
                      <span className="font-semibold text-neutral-200">
                        “I am 18+ — Enter Site”
                      </span>
                      , you acknowledge and accept these conditions.
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-xs text-neutral-600">
                  Protected entry screen for JB COLLECTIONS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}