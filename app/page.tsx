import Link from "next/link"

export default function HomePage() {
  return (
    <div className="bg-slate-50">
      <section className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        
        <div className="w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-100 to-indigo-200 px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
          
          {/* CENTER CONTENT */}
          <div className="mx-auto max-w-xl text-center">
            
            <h1 className="text-[36px] font-black leading-[0.95] tracking-[-0.03em] text-slate-900 sm:text-[52px] lg:text-7xl">
              Elevate your Experience with{" "}
              <span className="whitespace-nowrap text-blue-600">
                JB Collections
              </span>
            </h1>

            <p className="mt-5 text-base leading-7 text-slate-700 sm:text-lg">
              Discover expansive resources, premium downloads, and exclusive
              digital collections in one simple and user-friendly platform.
            </p>

            {/* BUTTONS */}
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-2xl bg-blue-600 px-8 text-lg font-bold text-white transition hover:bg-blue-700"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-2xl border-2 border-blue-600 bg-white px-8 text-lg font-bold text-blue-600 transition hover:bg-blue-50"
              >
                Create Account
              </Link>
            </div>

          </div>

        </div>

      </section>
    </div>
  )
}