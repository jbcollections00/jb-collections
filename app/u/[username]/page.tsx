import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase-server"
import PublicProfileActions from "@/app/components/PublicProfileActions"

type ProfileRow = {
  id: string
  full_name?: string | null
  name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  membership?: string | null
  role?: string | null
  is_premium?: boolean | null
  account_status?: string | null
  status?: string | null
}

function getDisplayName(profile: ProfileRow | null) {
  if (!profile) return "User"
  return (
    profile.full_name?.trim() ||
    profile.name?.trim() ||
    profile.username?.trim() ||
    "User"
  )
}

function getInitials(name: string) {
  const cleaned = name.trim()
  if (!cleaned) return "U"

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}

function getMembership(profile: ProfileRow | null) {
  const role = String(profile?.role || "").toLowerCase()
  const membership = String(profile?.membership || "").toLowerCase()

  if (role === "admin") return "Administrator"
  if (membership === "platinum") return "Platinum User"
  if (membership === "premium" || profile?.is_premium) return "Premium User"
  return "Standard User"
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()

  const normalizedUsername = String(username || "").trim().toLowerCase()

  if (!normalizedUsername) {
    notFound()
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, name, username, bio, avatar_url, membership, role, is_premium, account_status, status"
    )
    .eq("username", normalizedUsername)
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const displayName = getDisplayName(data)
  const initials = getInitials(displayName)
  const membership = getMembership(data)
  const status = data.account_status || data.status || "Active"
  const isOwner = Boolean(user?.id && user.id === data.id)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#020617_55%,_#030712_100%)]" />

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <Link
            href={isOwner ? "/profile" : "/dashboard"}
            className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {isOwner ? "Back to Profile" : "Back"}
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.26),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.22),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#020617_100%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute -left-10 top-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 top-0 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={displayName}
                className="h-28 w-28 rounded-[28px] object-cover ring-2 ring-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-white/10 text-3xl font-black ring-1 ring-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                {initials}
              </div>
            )}

            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/70">
                Public Profile
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">
                {displayName}
              </h1>
              <p className="mt-2 text-base text-slate-300">@{data.username}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-sky-500 to-violet-600 px-4 py-2 text-sm font-bold text-white">
                  {membership}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  {status}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/90 backdrop-blur-sm">
            {data.bio?.trim() || "This user has not added a bio yet."}
          </div>

          <PublicProfileActions
            username={normalizedUsername}
            displayName={displayName}
            isOwner={isOwner}
          />
        </section>
      </div>
    </div>
  )
}