import type { ReactNode } from "react"

export default function SecureAdminLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(to_bottom,_#020617,_#0f172a)]">
        {children}
      </div>
    </div>
  )
}