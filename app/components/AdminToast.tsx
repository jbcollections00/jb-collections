"use client"

import { useEffect } from "react"

type AdminToastProps = {
  open: boolean
  type?: "success" | "error" | "info" | "warning"
  title: string
  message: string
  onClose: () => void
  duration?: number
}

export default function AdminToast({
  open,
  type = "success",
  title,
  message,
  onClose,
  duration = 3200,
}: AdminToastProps) {
  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      onClose()
    }, duration)

    return () => window.clearTimeout(timer)
  }, [open, duration, onClose])

  if (!open) return null

  const styles = {
    success: {
      wrapper: "border-emerald-200 bg-white",
      badge: "bg-emerald-100 text-emerald-700",
      icon: "✅",
      title: "text-emerald-700",
      progress: "bg-emerald-500",
    },
    error: {
      wrapper: "border-red-200 bg-white",
      badge: "bg-red-100 text-red-700",
      icon: "❌",
      title: "text-red-700",
      progress: "bg-red-500",
    },
    warning: {
      wrapper: "border-amber-200 bg-white",
      badge: "bg-amber-100 text-amber-700",
      icon: "⚠️",
      title: "text-amber-700",
      progress: "bg-amber-500",
    },
    info: {
      wrapper: "border-blue-200 bg-white",
      badge: "bg-blue-100 text-blue-700",
      icon: "ℹ️",
      title: "text-blue-700",
      progress: "bg-blue-500",
    },
  }[type]

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] w-full max-w-sm animate-[toastIn_.25s_ease-out] sm:right-6 sm:top-6">
      <div
        className={`pointer-events-auto overflow-hidden rounded-2xl border shadow-2xl ${styles.wrapper}`}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${styles.badge}`}
          >
            {styles.icon}
          </div>

          <div className="min-w-0 flex-1">
            <p className={`text-sm font-extrabold ${styles.title}`}>{title}</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">{message}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>

        <div className="h-1.5 w-full bg-slate-100">
          <div
            className={`h-full ${styles.progress} animate-[toastProgress_var(--toast-duration)_linear_forwards]`}
            style={{ ["--toast-duration" as string]: `${duration}ms` }}
          />
        </div>
      </div>

      <style jsx global>{`
        @keyframes toastIn {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes toastProgress {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}