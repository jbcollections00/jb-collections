import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JB Collections",
  description: "Premium-ready file download platform",
  viewport: "width=device-width, initial-scale=1",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  )
}