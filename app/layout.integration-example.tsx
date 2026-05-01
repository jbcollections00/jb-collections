import type { Metadata } from "next"
import BackgroundAds from "@/app/components/BackgroundAds"
import "./globals.css"

export const metadata: Metadata = {
  title: "JB Collections",
  description: "Premium Access Hub",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <BackgroundAds />
      </body>
    </html>
  )
}
