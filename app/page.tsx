import Link from "next/link"

const floatingCoins = [
  {
    className: "left-[5%] top-[20%] w-28 sm:w-32 lg:w-40",
    style: { animationDelay: "0s", animationDuration: "12s" },
  },
  {
    className: "right-[5%] top-[25%] w-32 sm:w-36 lg:w-44",
    style: { animationDelay: "1s", animationDuration: "13s" },
  },
  {
    className: "left-[15%] bottom-[20%] w-20 sm:w-24 lg:w-28",
    style: { animationDelay: "2s", animationDuration: "11s" },
  },
  {
    className: "right-[18%] bottom-[18%] w-20 sm:w-24 lg:w-28",
    style: { animationDelay: "3s", animationDuration: "12s" },
  },
  {
    className: "left-[30%] top-[55%] w-16 sm:w-20 lg:w-24",
    style: { animationDelay: "1.5s", animationDuration: "10s" },
  },
  {
    className: "right-[28%] top-[60%] w-16 sm:w-20 lg:w-24",
    style: { animationDelay: "4s", animationDuration: "11s" },
  },
  {
    className: "left-[40%] top-[15%] w-12",
    style: { animationDelay: "2.5s", animationDuration: "9s" },
  },
  {
    className: "right-[40%] bottom-[25%] w-12",
    style: { animationDelay: "3.5s", animationDuration: "9.5s" },
  },
]

const features = [
  {
    title: "Premium Digital Library",
    description:
      "Access curated files, collections, and exclusive member-ready content in one clean platform.",
  },
  {
    title: "JB Coin Rewards",
    description:
      "Earn, use, and track JB Coins across downloads, activity, and premium actions inside your account.",
  },
  {
    title: "Fast Member Experience",
    description:
      "Smooth login, easy browsing, organized categories, and a more modern dashboard flow.",
  },
  {
    title: "Exclusive Access",
    description:
      "Unlock premium-only materials, special releases, and high-value digital content for members.",
  },
]

const previews = [
  {
    label: "Trending",
    title: "Premium File Collections",
    text: "Professionally arranged resources with a cleaner browsing experience.",
  },
  {
    label: "Members",
    title: "Exclusive Downloads",
    text: "High-value content reserved for users who want more than a basic library.",
  },
  {
    label: "Rewards",
    title: "JB Coin System",
    text: "A gamified experience that gives your users a reason to keep coming back.",
  },
]

const trustItems = [
  "Premium-style member platform",
  "Clean dashboard and profile experience",
  "JB Coin identity across the site",
  "Built for repeat visits and engagement",
]

const reasons = [
  {
    title: "Strong brand identity",
    text: "The JB Coin theme gives the platform a memorable look that feels unique instead of generic.",
  },
  {
    title: "Designed for conversion",
    text: "The page now explains what users get, why it matters, and what they can expect before signing up.",
  },
  {
    title: "Ready to scale",
    text: "The layout supports future additions like testimonials, featured categories, announcements, and offers.",
  },
]

export default function HomePage() {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#020617_0%,#0f172a_40%,#111827_100%)]" />

      <div className="absolute inset-0 opacity-90">
        <div className="animate-blob absolute -left-24 top-8 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
        <div
          className="animate-blob absolute right-0 top-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="animate-blob absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl"
          style={{ animationDelay: "4s" }}
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.06]" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floatingCoins.map((coin, index) => (
          <img
            key={index}
            src="/jb-coin.png"
            alt="JB Coin"
            className={`absolute ${coin.className} animate-float-coin opacity-95 drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]`}
            style={coin.style}
          />
        ))}

        <img
          src="/jb-coin.png"
          alt="JB Coin"
          className="absolute left-1/2 top-[18rem] w-40 sm:w-52 lg:w-64 -translate-x-1/2 opacity-20 animate-spin-slow drop-shadow-[0_0_40px_rgba(255,215,0,0.5)]"
        />
      </div>

      <main className="relative">
        <section className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/10 p-6 shadow-[0_20px_100px_rgba(0,0,0,0.50)] backdrop-blur-xl sm:p-10 lg:p-16">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Premium Digital Platform
              </div>

              <div className="mt-6 flex items-center gap-4">
                <img
                  src="/jb-logo.png"
                  alt="JB Collections Logo"
                  className="w-20 sm:w-24 drop-shadow-[0_10px_30px_rgba(59,130,246,0.35)]"
                />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
                    JB Collections
                  </p>
                  <p className="text-sm text-slate-400">Premium-ready file download platform</p>
                </div>
              </div>

              <h1 className="mt-8 max-w-4xl text-[38px] font-black leading-[0.92] tracking-[-0.045em] text-white sm:text-[56px] lg:text-7xl">
                Elevate Your Experience with{" "}
                <span className="animate-gradient-x inline-block bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-500 bg-[length:200%_200%] bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]">
                  JB Collections
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Join a premium-looking digital hub where members can explore exclusive files,
                unlock rewards, enjoy smoother access, and discover curated content built for repeat visits.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-black text-white">Exclusive</p>
                  <p className="mt-1 text-sm text-slate-400">Member-only digital collections</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-black text-white">Rewards</p>
                  <p className="mt-1 text-sm text-slate-400">JB Coin engagement system</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-black text-white">Premium</p>
                  <p className="mt-1 text-sm text-slate-400">Modern experience from landing to profile</p>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/signup"
                  className="animate-gradient-x inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 bg-[length:200%_200%] px-9 text-base font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition duration-300 hover:scale-[1.03]"
                >
                  Create Account
                </Link>

                <Link
                  href="/login"
                  className="inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-9 text-base font-bold text-white backdrop-blur-md transition duration-300 hover:scale-[1.03]"
                >
                  Login
                </Link>
              </div>
            </div>

            <div className="grid gap-5">
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">What you get</p>
                <div className="mt-5 space-y-4">
                  {features.map((feature) => (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <h3 className="text-base font-bold text-white">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-white/10 bg-white/8 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">Content preview</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">
                  Show users what they are signing up for
                </h2>
                <p className="mt-3 max-w-2xl text-slate-300">
                  Instead of only showing a hero, preview the value of the platform with real-looking cards.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200">
                Stronger conversion through visible value
              </div>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {previews.map((preview) => (
                <div
                  key={preview.title}
                  className="group rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      {preview.label}
                    </span>
                    <img src="/jb-coin.png" alt="JB Coin" className="h-9 w-9 animate-coin-shine" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-white">{preview.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{preview.text}</p>
                  <div className="mt-6 h-28 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="h-3 w-24 rounded-full bg-cyan-300/40" />
                    <div className="mt-3 space-y-2">
                      <div className="h-2 rounded-full bg-white/10" />
                      <div className="h-2 w-[90%] rounded-full bg-white/10" />
                      <div className="h-2 w-[75%] rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[30px] border border-white/10 bg-white/8 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">Why choose JB Collections</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">
                More than a beautiful homepage
              </h2>
              <div className="mt-6 space-y-5">
                {reasons.map((reason) => (
                  <div key={reason.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-lg font-bold text-white">{reason.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{reason.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/8 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">Trust signals</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl">
                Give visitors confidence before they sign up
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {trustItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-slate-200"
                  >
                    <span className="mr-2 text-cyan-300">✦</span>
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-[28px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(37,99,235,0.12))] p-6">
                <p className="text-sm uppercase tracking-[0.18em] text-cyan-100">Suggested next trust upgrades</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Add testimonials or member feedback</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Show featured categories or popular files</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Highlight premium plan benefits</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Add stats like users, files, or rewards claimed</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:pb-16">
          <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(30,41,59,0.65),rgba(37,99,235,0.15))] p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-10 lg:p-14">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">Ready to join?</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-white sm:text-5xl">
              Explore premium content and start building with JB Collections
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              A stronger landing page should not only impress users visually. It should also guide them clearly toward creating an account.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="animate-gradient-x inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 bg-[length:200%_200%] px-9 text-base font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition duration-300 hover:scale-[1.03]"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="inline-flex h-14 w-full sm:w-auto items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-9 text-base font-bold text-white backdrop-blur-md transition duration-300 hover:scale-[1.03]"
              >
                Member Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes gradientX {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes floatCoin {
          0% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-14px) rotate(6deg); }
          50% { transform: translateY(8px) rotate(-6deg); }
          75% { transform: translateY(-10px) rotate(4deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        @keyframes spinSlow {
          from { transform: translateX(-50%) rotate(0deg); }
          to { transform: translateX(-50%) rotate(360deg); }
        }

        @keyframes blobMove {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(24px,-18px) scale(1.08); }
          66% { transform: translate(-18px,20px) scale(0.96); }
        }

        @keyframes coinShine {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.06); filter: brightness(1.35); }
          100% { transform: scale(1); filter: brightness(1); }
        }

        .animate-gradient-x {
          animation: gradientX 5s ease infinite;
        }

        .animate-float-coin {
          animation: floatCoin 10s ease-in-out infinite, coinShine 3s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spinSlow 22s linear infinite;
        }

        .animate-blob {
          animation: blobMove 14s ease-in-out infinite;
        }

        .animate-coin-shine {
          animation: coinShine 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
