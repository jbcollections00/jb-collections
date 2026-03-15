import { Suspense } from "react"
import ProfilePageClient from "./ProfilePageClient"

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto w-full max-w-[1800px] px-4 py-6 lg:px-8">
            <div className="rounded-3xl border border-blue-100 bg-white p-6">
              <p className="text-sm font-semibold text-slate-600">
                Loading profile...
              </p>
            </div>
          </div>
        </div>
      }
    >
      <ProfilePageClient />
    </Suspense>
  )
}