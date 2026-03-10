"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminLoginRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/secure-admin-portal-7X9")
  }, [router])

  return null
}