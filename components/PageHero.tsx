"use client"

type PageHeroProps = {
  title: string
  subtitle?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  rightContent?: React.ReactNode
}

export default function PageHero({
  title,
  subtitle,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  rightContent,
}: PageHeroProps) {
  return (
    <div className="mb-8 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 px-6 py-8 text-white sm:px-8 sm:py-10">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white blur-3xl" />
          <div className="absolute right-0 top-6 h-48 w-48 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
              JB Collections
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
                {subtitle}
              </p>
            )}
          </div>

          <div className="w-full max-w-xl">
            {rightContent ? (
              rightContent
            ) : (
              <div className="rounded-[24px] bg-white/15 p-2 backdrop-blur-md">
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full rounded-[18px] border border-white/20 bg-white px-5 py-4 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}