"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { CSSProperties, FormEvent } from "react"

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    passwordRef.current?.focus()

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setError("Invalid or expired reset link.")
        }
      } finally {
        setChecking(false)
      }
    }

    checkSession()
  }, [supabase])

  const passwordTooShort = useMemo(() => {
    if (!password) return false
    return password.length < 6
  }, [password])

  const passwordsDoNotMatch = useMemo(() => {
    if (!confirmPassword) return false
    return password !== confirmPassword
  }, [password, confirmPassword])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setError("")
    setMessage("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        throw error
      }

      setMessage("Password updated successfully. Redirecting to login...")
      setPassword("")
      setConfirmPassword("")

      setTimeout(() => {
        router.push("/login")
      }, 1500)
    } catch (err: any) {
      setError(err?.message || "Failed to update password")
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
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

            <h1 style={titleStyle}>Reset Password</h1>

            <p style={subtitleStyle}>Checking reset link...</p>
          </div>
        </div>
      </main>
    )
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

          <h1 style={titleStyle}>Reset Password</h1>

          <p style={subtitleStyle}>
            Enter your new password for{" "}
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
            <label htmlFor="password" style={labelStyle}>
              New Password
            </label>

            <div style={passwordWrap}>
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                style={passwordInputStyle}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={showButton}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {passwordTooShort ? (
              <div style={helperErrorText}>
                Password must be at least 6 characters.
              </div>
            ) : null}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="confirmPassword" style={labelStyle}>
              Confirm Password
            </label>

            <div style={passwordWrap}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                style={passwordInputStyle}
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                style={showButton}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>

            {passwordsDoNotMatch ? (
              <div style={helperErrorText}>Passwords do not match.</div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading || passwordTooShort || passwordsDoNotMatch}
            style={{
              ...submitButton,
              opacity: loading || passwordTooShort || passwordsDoNotMatch ? 0.7 : 1,
              cursor:
                loading || passwordTooShort || passwordsDoNotMatch
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loading ? (
              <span style={buttonInner}>
                <span style={spinnerStyle} />
                Updating...
              </span>
            ) : (
              "Update Password"
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

const passwordWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  border: "1px solid #dbe4ff",
  borderRadius: "14px",
  height: "52px",
  overflow: "hidden",
  background: "#fff",
}

const passwordInputStyle: CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  padding: "0 14px",
  fontSize: "15px",
  background: "transparent",
  color: "#111827",
}

const showButton: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: "0 14px",
  color: "#1557ff",
  fontWeight: 700,
  cursor: "pointer",
  height: "100%",
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