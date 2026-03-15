"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { CSSProperties, FormEvent } from "react"

export default function LoginPage() {
  const supabase = createClient()
  const emailRef = useRef<HTMLInputElement | null>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [googleError, setGoogleError] = useState("")
  const [urlError, setUrlError] = useState("")

  useEffect(() => {
    emailRef.current?.focus()

    const savedEmail = window.localStorage.getItem("remembered_login_email")
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }

    const params = new URLSearchParams(window.location.search)
    const error = params.get("error") ?? ""
    setUrlError(error)
  }, [])

  const errorMessage = useMemo(() => {
    if (urlError === "invalid") return "Invalid email or password."
    if (urlError === "failed") return "Login failed. Please try again."
    if (urlError === "not-admin") return "You do not have admin access."
    return ""
  }, [urlError])

  const emailLooksValid = useMemo(() => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }, [email])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    setGoogleError("")

    if (!emailLooksValid) {
      e.preventDefault()
      return
    }

    if (rememberMe) {
      window.localStorage.setItem("remembered_login_email", email)
    } else {
      window.localStorage.removeItem("remembered_login_email")
    }

    setSubmitting(true)
  }

  async function handleGoogleLogin() {
    try {
      setGoogleError("")
      setGoogleLoading(true)

      const origin = window.location.origin

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: origin,
        },
      })

      if (error) {
        throw error
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed."
      setGoogleError(message)
      setGoogleLoading(false)
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

          <h1 style={titleStyle}>Welcome Back</h1>

          <p style={subtitleStyle}>
            Sign in to continue to{" "}
            <span style={{ fontWeight: 700, color: "#0d1635" }}>
              JB Collections
            </span>
          </p>
        </div>

        <form
          method="post"
          action="/api/auth/login"
          onSubmit={handleSubmit}
          style={{ marginTop: "20px" }}
        >
          {errorMessage ? <div style={errorBox}>{errorMessage}</div> : null}
          {googleError ? <div style={errorBox}>{googleError}</div> : null}

          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="email" style={labelStyle}>
              Email Address
            </label>

            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
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

          <div style={{ marginBottom: "10px" }}>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>

            <div style={passwordWrap}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                style={passwordInputStyle}
              />

              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                style={showButton}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div style={optionsRow}>
            <label style={rememberWrap}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={checkboxStyle}
              />
              <span>Remember email</span>
            </label>

            <Link href="/forgot-password" style={forgotLink}>
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            style={{
              ...submitButton,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
            disabled={submitting || !emailLooksValid}
          >
            {submitting ? (
              <span style={buttonInner}>
                <span style={spinnerStyle} />
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>

          <div style={dividerWrap}>
            <div style={dividerLine} />
            <span style={{ color: "#64748b", fontSize: "14px" }}>or</span>
            <div style={dividerLine} />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            style={{
              ...googleButton,
              opacity: googleLoading ? 0.7 : 1,
              cursor: googleLoading ? "not-allowed" : "pointer",
            }}
            disabled={googleLoading || submitting}
          >
            {googleLoading ? (
              <span style={buttonInner}>
                <span style={spinnerBlueStyle} />
                Redirecting...
              </span>
            ) : (
              <>
                <span style={{ fontSize: "20px", fontWeight: 800 }}>G</span>
                Continue with Google
              </>
            )}
          </button>

          <div style={signupWrap}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={signupLink}>
              Create one
            </Link>
          </div>
        </form>
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

const optionsRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "20px",
  flexWrap: "wrap",
}

const rememberWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#334155",
  fontSize: "14px",
  fontWeight: 600,
}

const checkboxStyle: CSSProperties = {
  width: "16px",
  height: "16px",
  accentColor: "#1557ff",
  cursor: "pointer",
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
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(21,87,255,0.24)",
}

const buttonInner: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
}

const dividerWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "22px 0",
}

const dividerLine: CSSProperties = {
  flex: 1,
  height: "1px",
  background: "#d6def8",
}

const googleButton: CSSProperties = {
  width: "100%",
  height: "54px",
  borderRadius: "14px",
  border: "2px solid #1557ff",
  background: "#fff",
  color: "#1557ff",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
}

const signupWrap: CSSProperties = {
  marginTop: "20px",
  textAlign: "center",
  fontSize: "14px",
  color: "#475569",
}

const signupLink: CSSProperties = {
  color: "#1557ff",
  fontWeight: 700,
  textDecoration: "none",
}

const forgotLink: CSSProperties = {
  color: "#1557ff",
  fontWeight: 600,
  fontSize: "14px",
  textDecoration: "underline",
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

const spinnerStyle: CSSProperties = {
  width: "16px",
  height: "16px",
  borderRadius: "999px",
  border: "2px solid rgba(255,255,255,0.45)",
  borderTopColor: "#ffffff",
  display: "inline-block",
  animation: "spin 0.8s linear infinite",
}

const spinnerBlueStyle: CSSProperties = {
  width: "16px",
  height: "16px",
  borderRadius: "999px",
  border: "2px solid rgba(21,87,255,0.25)",
  borderTopColor: "#1557ff",
  display: "inline-block",
  animation: "spin 0.8s linear infinite",
}