"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

const STORAGE_KEY = "jb_referral_code"

export default function ReferralHiddenInput() {
  const searchParams = useSearchParams()
  const [referralCode, setReferralCode] = useState("")

  const refFromUrl = useMemo(
    () => (searchParams?.get("ref") || "").trim().toUpperCase(),
    [searchParams]
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    if (refFromUrl) {
      localStorage.setItem(STORAGE_KEY, refFromUrl)
      setReferralCode(refFromUrl)
      return
    }

    const saved = localStorage.getItem(STORAGE_KEY) || ""
    setReferralCode(saved.trim().toUpperCase())
  }, [refFromUrl])

  return <input type="hidden" name="referralCode" value={referralCode} readOnly />
}