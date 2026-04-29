
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Task = {
  id: string
  title: string
  description: string
  reward: number
  type: "ad" | "visit"
  required_time: number
  link: string | null
  started?: boolean
  completed?: boolean
  completed_today?: boolean
  can_claim?: boolean
  can_start?: boolean
  claim_count?: number
  max_claims_per_day?: number
  remaining_claims?: number
  cooldown_seconds?: number
  cooldown_remaining?: number
  bonus_at_claim_count?: number | null
  bonus_reward?: number | null
  started_at?: string | null
  ready_at?: string | null
  completed_at?: string | null
  seconds_remaining?: number
}

type TasksResponse = {
  ok?: boolean
  tasks?: Task[]
  openTasks?: number
  availableCoins?: number
  error?: string
}

type TaskActionResponse = {
  ok?: boolean
  message?: string
  error?: string
  task?: Task
  coinsAdded?: number
  reward?: number
  baseReward?: number
  bonusReward?: number
  claimCount?: number
  maxClaims?: number
  seconds_remaining?: number
  cooldown_remaining?: number
}

type ClaimCelebration = {
  title: string
  reward: number
  bonusReward?: number
} | null

const RETURN_TASK_KEY = "jb_earn_return_task_id"
const RETURN_TASK_TITLE_KEY = "jb_earn_return_task_title"

function getSecondsRemaining(readyAt?: string | null) {
  if (!readyAt) return 0

  const readyDate = new Date(readyAt)
  if (Number.isNaN(readyDate.getTime())) return 0

  return Math.max(0, Math.ceil((readyDate.getTime() - Date.now()) / 1000))
}

function getCooldownRemaining(task: Task) {
  const cooldownFromApi = Number(task.cooldown_remaining || 0)

  if (task.completed_at) {
    const completedDate = new Date(task.completed_at)
    const cooldownSeconds = Number(task.cooldown_seconds || 0)

    if (!Number.isNaN(completedDate.getTime()) && cooldownSeconds > 0) {
      const secondsSinceCompleted = Math.floor((Date.now() - completedDate.getTime()) / 1000)
      return Math.max(0, cooldownSeconds - secondsSinceCompleted)
    }
  }

  return Math.max(0, cooldownFromApi)
}

function getTaskIcon(task: Task) {
  if (task.id === "watch_ad") return "🎥"
  if (task.id === "visit_store") return "🛒"
  if (task.id === "leaderboard") return "🏆"
  if (task.id === "browse") return "📚"
  return "🎯"
}

function getTaskTone(task: Task) {
  if (task.type === "ad") {
    return {
      badge: "Money Task",
      border: "border-yellow-400/25",
      text: "text-yellow-300",
      glow: "shadow-yellow-950/20",
    }
  }

  return {
    badge: "Engagement",
    border: "border-cyan-400/20",
    text: "text-cyan-200",
    glow: "shadow-cyan-950/20",
  }
}

function isAdTask(task: Task) {
  return task.type === "ad" || task.id === "watch_ad"
}

export default function EarnTasksSection() {
  const router = useRouter()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [workingTaskId, setWorkingTaskId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [tick, setTick] = useState(0)
  const [returnPopupTaskId, setReturnPopupTaskId] = useState<string | null>(null)
  const [returnPopupTitle, setReturnPopupTitle] = useState("")
  const [claimCelebration, setClaimCelebration] = useState<ClaimCelebration>(null)

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const storedTaskId = window.sessionStorage.getItem(RETURN_TASK_KEY)
    const storedTaskTitle = window.sessionStorage.getItem(RETURN_TASK_TITLE_KEY) || ""

    if (storedTaskId) {
      setReturnPopupTaskId(storedTaskId)
      setReturnPopupTitle(storedTaskTitle)
    }
  }, [])

  useEffect(() => {
    if (!claimCelebration) return

    const timeout = window.setTimeout(() => {
      setClaimCelebration(null)
    }, 2800)

    return () => window.clearTimeout(timeout)
  }, [claimCelebration])

  const decoratedTasks = useMemo(() => {
    return tasks.map((task) => {
      const maxClaims = Math.max(1, Number(task.max_claims_per_day || 1))
      const claimCount = Number(task.claim_count || 0)
      const completed = Boolean(task.completed) || Boolean(task.completed_today) || claimCount >= maxClaims
      const started = Boolean(task.started) || Boolean(task.started_at)
      const secondsRemaining = completed ? 0 : getSecondsRemaining(task.ready_at)
      const cooldownRemaining = completed ? 0 : getCooldownRemaining(task)
      const canClaim = Boolean(task.can_claim) || (started && !completed && secondsRemaining <= 0)
      const canStart = Boolean(task.can_start) || (!completed && !started && cooldownRemaining <= 0)

      return {
        ...task,
        started,
        completed,
        completed_today: completed,
        seconds_remaining: secondsRemaining,
        cooldown_remaining: cooldownRemaining,
        can_claim: canClaim,
        can_start: canStart,
        claim_count: claimCount,
        max_claims_per_day: maxClaims,
        remaining_claims: Math.max(0, maxClaims - claimCount),
      }
    })
  }, [tasks, tick])

  const openTasks = decoratedTasks.filter((task) => !task.completed).length
  const availableCoins = decoratedTasks
    .filter((task) => task.can_claim)
    .reduce((sum, task) => sum + Number(task.reward || 0), 0)

  const returnTask = returnPopupTaskId
    ? decoratedTasks.find((task) => task.id === returnPopupTaskId) || null
    : null

  async function loadTasks() {
    try {
      setLoading(true)
      setError("")

      const response = await fetch("/api/rewards/tasks", {
        method: "GET",
        cache: "no-store",
      })

      const data = (await response.json()) as TasksResponse

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load earn tasks.")
      }

      setTasks(Array.isArray(data.tasks) ? data.tasks : [])
      setError("")
    } catch (err) {
      console.error("LOAD TASKS ERROR:", err)
      setError(err instanceof Error ? err.message : "Failed to load earn tasks.")
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  function updateTask(updatedTask: Task) {
    setTasks((currentTasks) => {
      const exists = currentTasks.some((task) => task.id === updatedTask.id)

      if (!exists) return currentTasks

      return currentTasks.map((task) =>
        task.id === updatedTask.id ? { ...task, ...updatedTask } : task
      )
    })
  }

  function rememberReturnTask(task: Task) {
    if (typeof window === "undefined") return

    window.sessionStorage.setItem(RETURN_TASK_KEY, task.id)
    window.sessionStorage.setItem(RETURN_TASK_TITLE_KEY, task.title)

    setReturnPopupTaskId(task.id)
    setReturnPopupTitle(task.title)
  }

  function clearReturnTask() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(RETURN_TASK_KEY)
      window.sessionStorage.removeItem(RETURN_TASK_TITLE_KEY)
    }

    setReturnPopupTaskId(null)
    setReturnPopupTitle("")
  }

  function openTaskLink(task: Task) {
    if (!task.link) return

    if (task.link.startsWith("http")) {
      window.location.href = task.link
      return
    }

    router.push(task.link)
  }

  async function runTaskAction(task: Task, action: "start" | "claim") {
    try {
      setWorkingTaskId(task.id)
      setError("")
      setMessage("")

      const response = await fetch("/api/rewards/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          action,
          taskId: task.id,
          task_id: task.id,
        }),
      })

      const data = (await response.json()) as TaskActionResponse

      if (!response.ok) {
        if (data.task) updateTask(data.task)
        throw new Error(data?.error || "Task action failed.")
      }

      if (data.task) {
        updateTask(data.task)
      }

      if (data.message) {
        setMessage(data.message)
      }

      if (action === "start") {
        rememberReturnTask(task)

        window.setTimeout(() => {
          openTaskLink(task)
        }, 450)
      }

      if (action === "claim") {
        const reward = Number(data.coinsAdded || data.reward || task.reward || 0)
        const bonusReward = Number(data.bonusReward || 0)

        setClaimCelebration({
          title: task.title,
          reward,
          bonusReward,
        })

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("jb-coins-updated", {
              detail: {
                reward,
                taskId: task.id,
              },
            }),
          )
        }

        if (!data.task || data.task.completed) {
          clearReturnTask()
        }

        await loadTasks()
      }
    } catch (err) {
      console.error("TASK ACTION ERROR:", err)
      setError(err instanceof Error ? err.message : "Task action failed.")
    } finally {
      setWorkingTaskId(null)
    }
  }

  function getButtonLabel(task: Task) {
    if (task.completed) return isAdTask(task) ? "Ad Limit Reached" : "Completed Today"
    if (workingTaskId === task.id) return "Please wait..."
    if (task.can_claim) return `Claim +${task.reward} Coins`
    if (Number(task.cooldown_remaining || 0) > 0) return "Cooldown Active"
    if (task.started) return "Check Status"
    if (isAdTask(task)) {
      return `Watch Ad ${Number(task.claim_count || 0) + 1}/${Number(task.max_claims_per_day || 5)}`
    }
    return "Start Task"
  }

  function getButtonDisabled(task: Task) {
    if (workingTaskId === task.id) return true
    if (task.completed) return true
    if (Number(task.cooldown_remaining || 0) > 0 && !task.can_claim) return true
    return false
  }

  function handleTaskButton(task: Task) {
    if (task.completed) return

    if (task.can_claim) {
      void runTaskAction(task, "claim")
      return
    }

    if (task.started) {
      void loadTasks()
      return
    }

    if (Number(task.cooldown_remaining || 0) > 0) return

    void runTaskAction(task, "start")
  }

  async function handlePopupMainAction() {
    if (!returnTask) {
      await loadTasks()
      return
    }

    if (returnTask.can_claim) {
      void runTaskAction(returnTask, "claim")
      return
    }

    await loadTasks()
  }

  return (
    <section className="relative mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.1),transparent_34%)]" />

      <div className="relative">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
              <span>Earn Coins</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              <span>5 Ads Daily</span>
            </div>

            <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Complete site-boosting tasks
            </h2>

            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
              Watch up to 5 sponsor ads per day, complete engagement tasks, then return here to claim your JB Coins.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:min-w-[360px]">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-5 py-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                Open Tasks
              </div>
              <div className="mt-2 text-3xl font-black text-white">{openTasks}</div>
            </div>

            <div className="rounded-[22px] border border-yellow-400/20 bg-yellow-400/10 px-5 py-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-100/80">
                Available
              </div>
              <div className="mt-2 text-3xl font-black text-yellow-300">
                +{availableCoins}
              </div>
            </div>
          </div>
        </div>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.05]"
                />
              ))}
            </div>
          ) : decoratedTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center text-sm text-slate-300">
              No earn tasks available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {decoratedTasks.map((task) => {
                const tone = getTaskTone(task)
                const disabled = getButtonDisabled(task)
                const claimCount = Number(task.claim_count || 0)
                const maxClaims = Number(task.max_claims_per_day || 1)
                const cooldownRemaining = Number(task.cooldown_remaining || 0)

                return (
                  <div
                    key={task.id}
                    className={`rounded-[26px] border bg-white/[0.05] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.24)] ${tone.border} ${tone.glow}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40 text-2xl">
                        {getTaskIcon(task)}
                      </div>

                      <div
                        className={`rounded-full border border-current/20 bg-current/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${tone.text}`}
                      >
                        {tone.badge}
                      </div>
                    </div>

                    <h3 className="mt-5 text-xl font-black text-white">
                      {task.title}
                    </h3>

                    <p className="mt-3 min-h-[78px] text-sm leading-6 text-slate-300">
                      {task.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-sm font-black text-yellow-300">
                        +{task.reward} coins
                      </div>

                      {isAdTask(task) ? (
                        <div className="text-xs font-bold text-slate-300">
                          {claimCount}/{maxClaims} today
                        </div>
                      ) : task.started && !task.completed ? (
                        <div className="text-xs font-semibold text-slate-400">
                          {task.can_claim ? "Ready" : "In progress"}
                        </div>
                      ) : null}
                    </div>

                    {isAdTask(task) && task.bonus_at_claim_count && task.bonus_reward ? (
                      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100">
                        Bonus: watch {task.bonus_at_claim_count} ads today to get +{task.bonus_reward} extra coins.
                      </div>
                    ) : null}

                    {cooldownRemaining > 0 && !task.completed && !task.can_claim ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-bold text-slate-300">
                        Cooldown active. Try again soon.
                      </div>
                    ) : null}

                    {task.completed ? (
                      <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-center text-xs font-bold text-emerald-100">
                        {isAdTask(task) ? "All ads completed today" : "Reward claimed today"}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleTaskButton(task)}
                      disabled={disabled}
                      className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black transition ${
                        disabled
                          ? "cursor-not-allowed bg-slate-600/70 text-slate-300"
                          : task.can_claim
                            ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-slate-950 hover:brightness-110"
                            : "bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white hover:brightness-110"
                      }`}
                    >
                      {getButtonLabel(task)}
                    </button>

                    {task.started && !task.completed && !task.can_claim && task.link ? (
                      <button
                        type="button"
                        onClick={() => openTaskLink(task)}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
                      >
                        Open required page
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {returnPopupTaskId ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/10 bg-[#081226] p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_34%)]" />

            <div className="relative">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-400/10 text-3xl">
                🎯
              </div>

              <h3 className="mt-5 text-2xl font-black text-white">
                Welcome back!
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                You returned from{" "}
                <span className="font-bold text-cyan-200">
                  {returnTask?.title || returnPopupTitle || "your task"}
                </span>
                . Claim your reward when it is ready.
              </p>

              <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-lg font-black text-yellow-300">
                +{returnTask?.reward || 0} JB Coins
              </div>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={handlePopupMainAction}
                  disabled={Boolean(returnTask && workingTaskId === returnTask.id)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    returnTask?.can_claim
                      ? "bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-600 text-white shadow-cyan-950/30 hover:brightness-110"
                      : "bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-blue-950/30 hover:brightness-110"
                  }`}
                >
                  {returnTask?.can_claim
                    ? workingTaskId === returnTask.id
                      ? "Claiming..."
                      : "Claim Reward"
                    : "Check Reward Status"}
                </button>

                <button
                  type="button"
                  onClick={clearReturnTask}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.1]"
                >
                  Close
                </button>
              </div>

              {returnTask && !returnTask.can_claim && !returnTask.completed ? (
                <p className="mt-4 text-xs font-semibold text-slate-400">
                  Task is being verified. You can check again shortly.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {claimCelebration ? (
        <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center px-4">
          <div className="relative overflow-hidden rounded-[32px] border border-yellow-300/30 bg-slate-950/90 px-8 py-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-md animate-[coinPop_2.8s_ease-in-out_forwards]">
            <div className="absolute -left-4 top-4 text-3xl animate-[coinFloat_1.4s_ease-in-out_infinite]">
              🪙
            </div>
            <div className="absolute right-5 top-3 text-2xl animate-[coinFloat_1.7s_ease-in-out_infinite]">
              ✨
            </div>
            <div className="absolute bottom-4 left-8 text-2xl animate-[coinFloat_1.5s_ease-in-out_infinite]">
              💰
            </div>
            <div className="absolute bottom-5 right-8 text-2xl animate-[coinFloat_1.9s_ease-in-out_infinite]">
              🪙
            </div>

            <div className="relative">
              <div className="text-5xl">🎉</div>
              <div className="mt-3 text-3xl font-black text-yellow-300">
                +{claimCelebration.reward} JB
              </div>
              <div className="mt-2 text-lg font-black text-white">
                Reward Claimed!
              </div>
              {claimCelebration.bonusReward ? (
                <div className="mt-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200">
                  Includes +{claimCelebration.bonusReward} bonus coins
                </div>
              ) : null}
              <p className="mt-2 text-sm text-slate-300">
                {claimCelebration.title}
              </p>
            </div>
          </div>

          <style jsx>{`
            @keyframes coinPop {
              0% {
                opacity: 0;
                transform: scale(0.72) translateY(20px);
              }
              16% {
                opacity: 1;
                transform: scale(1.06) translateY(0);
              }
              78% {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
              100% {
                opacity: 0;
                transform: scale(0.94) translateY(-18px);
              }
            }

            @keyframes coinFloat {
              0%,
              100% {
                transform: translateY(0) rotate(0deg);
              }
              50% {
                transform: translateY(-14px) rotate(10deg);
              }
            }
          `}</style>
        </div>
      ) : null}
    </section>
  )
}
