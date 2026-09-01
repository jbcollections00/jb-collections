import "./globals.css"
import type { Metadata } from "next"
import Script from "next/script"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import LayoutShell from "./components/LayoutShell"
import BackgroundAds from "@/app/components/BackgroundAds"
import ScriptElementGuard from "./components/ScriptElementGuard"
import AdBlockDetector from "./components/AdBlockDetector"
import TelegramAutoAuth from "./components/TelegramAutoAuth"

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://jb-collections.com"
  ).replace(/\/+$/, "")
}

const siteUrl = getSiteUrl()
const defaultPreview = `${siteUrl}/default-preview.jpg`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "JB Collections",
  description: "Premium-ready file download platform",
  openGraph: {
    title: "JB Collections",
    description: "Premium-ready file download platform",
    url: siteUrl,
    siteName: "JB Collections",
    type: "website",
    images: [
      {
        url: defaultPreview,
        width: 1200,
        height: 630,
        alt: "JB Collections",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JB Collections",
    description: "Premium-ready file download platform",
    images: [defaultPreview],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
}

// Helper function to check if the current user is an admin
async function getIsAdmin() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    // Check the profiles table using your existing schema
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single()

    return profile?.is_admin === true || profile?.role === "admin"
  } catch (error) {
    console.error("Error checking admin status:", error)
    return false
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isAdmin = await getIsAdmin()

  return (
    <html lang="en">
      <head>
        {/* ✈️ Telegram Web App SDK */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        {/* 💰 Monetag Telegram Mini App SDK */}
        <Script
          src="//libtl.com/sdk.js"
          data-zone="11699030"
          data-sdk="show_11699030"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        
        {/* ✈️ Auto-Authenticate Telegram Mini App Users */}
        <TelegramAutoAuth />

        {/* 🛡️ Client-side safe guard component (Runs for everyone) */}
        <ScriptElementGuard />

        {/* Core Layout (Runs for everyone) */}
        <LayoutShell>{children}</LayoutShell>

        {/* 🛑 CONDITIONALLY RENDER ADS AND DETECTORS (Runs ONLY if NOT admin) */}
        {!isAdmin && (
          <>
            {/* ✅ Google AdSense Script */}
            <Script
              async
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6646475793737493"
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />

            {/* 🚀 Effective CPM Network Script */}
            <Script
              id="effective-cpm-ad"
              src="https://pl30860037.effectivecpmnetwork.com/ab/fc/2b/abfc2b67797cad69eeb017f892ecfcd9.js"
              strategy="afterInteractive"
            />

            {/* 🚨 Anti-AdBlock Detection Modal */}
            <AdBlockDetector />

            {/* 🔥 Background & Popunder Ads */}
            <BackgroundAds />

            {/* ExoClick Popunder Zone: 6002936 */}
            <Script
              id="exoclick-popunder"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  (function() {
                    var adConfig = {
                      "ads_host": "a.pemsrv.com",
                      "syndication_host": "s.pemsrv.com",
                      "idzone": 6002936,
                      "popup_fallback": false,
                      "popup_force": false,
                      "chrome_enabled": true,
                      "new_tab": false,
                      "frequency_period": 1440,
                      "frequency_count": 1,
                      "trigger_method": 3,
                      "trigger_class": "",
                      "trigger_delay": 0,
                      "capping_enabled": true,
                      "tcf_enabled": true,
                      "agego_cross_site_enabled": true,
                      "only_inline": false
                    };

                    var s = document.createElement("script");
                    s.type = "text/javascript";
                    s.async = true;
                    s.src = "https://a.pemsrv.com/popunder1000.js";
                    for (var key in adConfig) {
                      s.setAttribute("data-exo-" + key, adConfig[key]);
                    }
                    document.body.appendChild(s);
                  })();
                `,
              }}
            />
          </>
        )}
      </body>
    </html>
  )
}