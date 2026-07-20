"use client"

import { useRouter } from "next/navigation"

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

export default function HomePage() {
  const router = useRouter()

  const handleContinue = () => {
    // Check if user is logged in via cookies, localStorage, or auth session
    const isLoggedIn = 
      typeof window !== "undefined" && 
      (localStorage.getItem("token") !== null || localStorage.getItem("user") !== null)

    if (isLoggedIn) {
      router.push("/dashboard")
    } else {
      router.push("/login")
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex items-center justify-center">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#020617_0%,#0f172a_40%,#111827_100%)]" />

      {/* Animated Glow Blobs */}
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

      {/* Floating Coins Effect */}
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
          className="absolute left-1/2 top-1/2 w-40 sm:w-52 lg:w-64 -translate-x-1/2 -translate-y-1/2 opacity-20 animate-spin-slow drop-shadow-[0_0_40px_rgba(255,215,0,0.5)]"
        />
      </div>

      <main className="relative z-10 w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="relative w-full overflow-hidden rounded-[34px] border border-white/10 bg-white/10 p-8 text-center shadow-[0_20px_100px_rgba(0,0,0,0.50)] backdrop-blur-xl sm:p-12 lg:p-16">
          
          <div className="mt-4 flex flex-col items-center justify-center gap-3">
            <img
              src="/jb-logo.png"
              alt="JB Collections Logo"
              className="w-20 sm:w-24 drop-shadow-[0_10px_30px_rgba(59,130,246,0.35)]"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
                JB Collections
              </p>
            </div>
          </div>

          <h1 className="mx-auto mt-8 max-w-3xl text-[38px] font-black leading-[0.95] tracking-[-0.045em] text-white sm:text-[56px] lg:text-7xl">
            Elevate Your Experience with{" "}
            <span className="animate-gradient-x inline-block bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-500 bg-[length:200%_200%] bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]">
              JB Collections
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            Join a premium-looking digital hub where members can explore exclusive files,
            unlock rewards, enjoy smoother access, and discover curated content built for repeat visits.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={handleContinue}
              className="animate-gradient-x inline-flex h-14 w-full sm:w-64 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 bg-[length:200%_200%] px-10 text-base font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition duration-300 hover:scale-[1.03]"
            >
              Continue
            </button>
          </div>

        </div>
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
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
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
      `}</style>
    </div>
  )
}