"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Props = {
  username: string
  displayName: string
  isOwner?: boolean
}

type ViewsResponse = {
  ok?: boolean
  views?: number
  visitors?: number
}

type FollowResponse = {
  ok?: boolean
  followers?: number
  following?: number
  isFollowing?: boolean
  counted?: boolean
  error?: string
}

type ReactResponse = {
  ok?: boolean
  likes?: number
  hasLiked?: boolean
  error?: string
}

export default function PublicProfileActions({
  username,
  displayName,
  isOwner = false,
}: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [views, setViews] = useState(0)
  const [visitors, setVisitors] = useState(0)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [likes, setLikes] = useState(0)

  const [isFollowing, setIsFollowing] = useState(false)
  const [hasLiked, setHasLiked] = useState(false)

  const [loadingStats, setLoadingStats] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [messageLoading, setMessageLoading] = useState(false)

  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  useEffect(() => {
    let active = true

    async function loadAll() {
      try {
        setLoadingStats(true)

        const [viewsRes, followRes, reactRes] = await Promise.all([
          fetch(`/api/profile/views?username=${encodeURIComponent(username)}`, {
            cache: "no-store",
          }),
          fetch(`/api/profile/follow?username=${encodeURIComponent(username)}`, {
            cache: "no-store",
          }),
          fetch(`/api/profile/react?username=${encodeURIComponent(username)}`, {
            cache: "no-store",
          }),
        ])

        const viewsData = (await viewsRes.json().catch(() => ({}))) as ViewsResponse
        const followData = (await followRes.json().catch(() => ({}))) as FollowResponse
        const reactData = (await reactRes.json().catch(() => ({}))) as ReactResponse

        if (!active) return

        if (viewsData.ok) {
          setViews(Number(viewsData.views || 0))
          setVisitors(Number(viewsData.visitors || 0))
        }

        if (followData.ok) {
          setFollowers(Number(followData.followers || 0))
          setFollowing(Number(followData.following || 0))
          setIsFollowing(Boolean(followData.isFollowing))
        }

        if (reactData.ok) {
          setLikes(Number(reactData.likes || 0))
          setHasLiked(Boolean(reactData.hasLiked))
        }
      } catch (err) {
        console.error("Public profile stats load error:", err)
      } finally {
        if (active) setLoadingStats(false)
      }
    }

    void fetch("/api/profile/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    }).catch((err) => {
      console.error("Profile view tracking error:", err)
    })

    void loadAll()

    return () => {
      active = false
    }
  }, [username])

  async function handleFollow() {
    try {
      setFollowLoading(true)
      setError("")
      setInfo("")

      const response = await fetch("/api/profile/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })

      const data = (await response.json().catch(() => ({}))) as FollowResponse

      if (!response.ok || !data.ok) {
        setError(data.error || "Failed to update follow status.")
        return
      }

      setIsFollowing(Boolean(data.isFollowing))
      setFollowers(Number(data.followers || 0))
      setFollowing(Number(data.following || 0))
      setInfo(
        Boolean(data.isFollowing)
          ? `You are now following ${displayName}.`
          : `You unfollowed ${displayName}.`
      )
    } catch (err) {
      console.error("Follow action error:", err)
      setError("Failed to update follow status.")
    } finally {
      setFollowLoading(false)
    }
  }

  async function handleLike() {
    try {
      setLikeLoading(true)
      setError("")
      setInfo("")

      const response = await fetch("/api/profile/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })

      const data = (await response.json().catch(() => ({}))) as ReactResponse

      if (!response.ok || !data.ok) {
        setError(data.error || "Failed to update reaction.")
        return
      }

      setHasLiked(Boolean(data.hasLiked))
      setLikes(Number(data.likes || 0))
      setInfo(
        Boolean(data.hasLiked)
          ? `You liked ${displayName}'s profile.`
          : "You removed your like."
      )
    } catch (err) {
      console.error("Profile like error:", err)
      setError("Failed to update reaction.")
    } finally {
      setLikeLoading(false)
    }
  }

  async function handleMessage() {
    try {
      setMessageLoading(true)
      setError("")
      setInfo("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      const { data: targetProfile, error: targetError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle()

      if (targetError || !targetProfile?.id) {
        setError("Could not find this user.")
        return
      }

      if (targetProfile.id === user.id) {
        setInfo("This is your own profile.")
        return
      }

      const { data: conversationId, error: rpcError } = await supabase.rpc(
        "create_direct_conversation",
        {
          other_user_id: targetProfile.id,
        }
      )

      if (rpcError) {
        console.error("Create conversation error:", rpcError)
        setError(rpcError.message || "Could not open message thread.")
        return
      }

      const nextId = String(conversationId || "")
      if (nextId) {
        router.push(`/messages?conversation=${encodeURIComponent(nextId)}`)
      } else {
        router.push("/messages")
      }
    } catch (err) {
      console.error("Message button error:", err)
      setError("Could not open message thread.")
    } finally {
      setMessageLoading(false)
    }
  }

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Views</p>
          <p className="mt-2 text-2xl font-black text-white">
            {loadingStats ? "..." : views}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Visitors</p>
          <p className="mt-2 text-2xl font-black text-white">
            {loadingStats ? "..." : visitors}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Followers</p>
          <p className="mt-2 text-2xl font-black text-white">
            {loadingStats ? "..." : followers}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Following</p>
          <p className="mt-2 text-2xl font-black text-white">
            {loadingStats ? "..." : following}
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Likes</p>
          <p className="mt-2 text-2xl font-black text-white">
            {loadingStats ? "..." : likes}
          </p>
        </div>
      </div>

      {!isOwner ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleFollow()}
            disabled={followLoading}
            className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
              isFollowing
                ? "border border-white/15 bg-white/10 text-white hover:bg-white/15"
                : "bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white hover:brightness-110"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {followLoading ? "Please wait..." : isFollowing ? "Following" : "Follow"}
          </button>

          <button
            type="button"
            onClick={() => void handleLike()}
            disabled={likeLoading}
            className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
              hasLiked
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:brightness-110"
                : "border border-white/15 bg-white/10 text-white hover:bg-white/15"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {likeLoading ? "Please wait..." : hasLiked ? "Liked ❤️" : "Like Profile"}
          </button>

          <button
            type="button"
            onClick={() => void handleMessage()}
            disabled={messageLoading}
            className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {messageLoading ? "Opening..." : "Message"}
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <Link
            href="/profile"
            className="inline-flex rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
          >
            Edit Your Profile
          </Link>
        </div>
      )}

      {(info || error) && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            error
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {error || info}
        </div>
      )}
    </div>
  )
}