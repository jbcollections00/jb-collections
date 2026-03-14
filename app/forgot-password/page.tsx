"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { CSSProperties, FormEvent } from "react"

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const emailRef = useRef<HTMLInputElement | null>(null)

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const emailLooksValid = useMemo(() => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }, [email])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setMessage("")
    setError("")

    if (!emailLooksValid) {
      setError("Please enter a valid email address.")
      return
    }

    setLoading(true)

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : ""

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      })

      if (error) {
        throw error
      }

      setMessage("Password reset link sent. Please check your email.")
      setEmail("")
    } catch (err: any) {
      setError(err?.message || "Failed to send reset email")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerWrap}>
          <Image
            src="/jb-logo.png"
            alt="JB Collections"
            width={70}
            height={70}
            priority
            style={{
              width: "70px",
              height: "auto",
              margin: "0 auto 14px",
              opacity: 0.9,
            }}
          />

          <h1 style={titleStyle}>Forgot Password</h1>

          <p style={subtitleStyle}>
            Enter your email address and we&apos;ll send you a password reset
            link for{" "}
            <span style={{ fontWeight: 700, color: "#0d1635" }}>
              JB Collections
            </span>
            .
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
          {message ? <div style={successBox}>{message}</div> : null}
          {error ? <div style={errorBox}>{error}</div> : null}

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="email" style={labelStyle}>
              Email Address
            </label>

            <input
              ref={emailRef}
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                ...inputStyle,
                border:
                  email && !emailLooksValid
                    ? "1px solid #f87171"
                    : inputStyle.border,
              }}
            />

            {email && !emailLooksValid ? (
              <div style={helperErrorText}>
                Please enter a valid email address.
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading || !emailLooksValid}
            style={{
              ...submitButton,
              opacity: loading || !emailLooksValid ? 0.7 : 1,
              cursor: loading || !emailLooksValid ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <span style={buttonInner}>
                <span style={spinnerStyle} />
                Sending...
              </span>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div style={footerWrap}>
          <Link href="/login" style={backLink}>
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #eef2fb 0%, #e8eefc 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
}

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "480px",
  background: "#c3cff8",
  borderRadius: "28px",
  boxShadow: "0 24px 55px rgba(0,0,0,0.08)",
  padding: "32px 24px",
}

const headerWrap: CSSProperties = {
  textAlign: "center",
  marginBottom: "10px",
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "26px",
  fontWeight: 800,
  color: "#0d1635",
}

const subtitleStyle: CSSProperties = {
  marginTop: "10px",
  fontSize: "15px",
  color: "#475569",
  lineHeight: "1.6",
}

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#334155",
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: "52px",
  borderRadius: "14px",
  border: "1px solid #dbe4ff",
  padding: "0 14px",
  fontSize: "15px",
  outline: "none",
  background: "#ffffff",
  color: "#111827",
}

const helperErrorText: CSSProperties = {
  marginTop: "8px",
  color: "#b91c1c",
  fontSize: "13px",
  fontWeight: 600,
}

const submitButton: CSSProperties = {
  width: "100%",
  height: "56px",
  borderRadius: "14px",
  border: "none",
  background: "#1557ff",
  color: "#fff",
  fontSize: "17px",
  fontWeight: 700,
  boxShadow: "0 10px 24px rgba(21,87,255,0.24)",
}

const buttonInner: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
}

const footerWrap: CSSProperties = {
  marginTop: "20px",
  textAlign: "center",
}

const backLink: CSSProperties = {
  color: "#1557ff",
  fontWeight: 600,
  fontSize: "14px",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
}

const errorBox: CSSProperties = {
  marginBottom: "14px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: "14px",
  fontWeight: 600,
}

const successBox: CSSProperties = {
  marginBottom: "14px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  fontSize: "14px",
  fontWeight: 600,
}

const spinnerStyle: CSSProperties = {
  width: "16px",
  height: "16px",
  borderRadius: "999px",
  border: "2px solid rgba(255,255,255,0.45)",
  borderTopColor: "#ffffff",
  display: "inline-block",
  animation: "spin 0.8s linear infinite",
}