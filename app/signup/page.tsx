"use client"

import Image from "next/image"
import Link from "next/link"
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageContent />
    </Suspense>
  )
}

function SignupPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const fullNameRef = useRef<HTMLInputElement | null>(null)

  const errorParam = searchParams?.get("error") ?? ""

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState("")

  useEffect(() => {
    fullNameRef.current?.focus()
  }, [])

  const errorMessage = useMemo(() => {
    if (!errorParam) return ""

    if (errorParam === "missing-fields") {
      return "Please complete all required fields."
    }

    if (errorParam === "invalid-email") {
      return "Please enter a valid email address."
    }

    if (errorParam === "password-too-short") {
      return "Password must be at least 6 characters."
    }

    if (errorParam === "password-mismatch") {
      return "Passwords do not match."
    }

    if (errorParam === "email-exists") {
      return "This email is already registered."
    }

    if (errorParam === "failed") {
      return "Sign up failed. Please try again."
    }

    return errorParam
  }, [errorParam])

  const emailValid = useMemo(() => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }, [email])

  const passwordValid = useMemo(() => {
    if (!password) return true
    return password.length >= 6
  }, [password])

  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return true
    return password === confirmPassword
  }, [password, confirmPassword])

  const formValid =
    !!fullName.trim() &&
    !!email.trim() &&
    !!password.trim() &&
    !!confirmPassword.trim() &&
    emailValid &&
    passwordValid &&
    passwordsMatch

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    setGoogleError("")

    if (!formValid) {
      e.preventDefault()
      return
    }

    setSubmitting(true)
  }

  async function handleGoogleSignup() {
    try {
      setGoogleError("")
      setGoogleLoading(true)

      const origin = window.location.origin

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}`,
        },
      })

      if (error) {
        throw error
      }
    } catch (err: any) {
      setGoogleError(err?.message || "Google sign-up failed.")
      setGoogleLoading(false)
    }
  }

  return (
    <SignupLayout>
      <form
        method="post"
        action="/api/auth/signup"
        onSubmit={handleSubmit}
        style={{ marginTop: "20px" }}
      >
        {errorMessage ? <div style={errorBox}>{errorMessage}</div> : null}
        {googleError ? <div style={errorBox}>{googleError}</div> : null}

        <FloatingInput
          inputRef={fullNameRef}
          id="fullName"
          name="fullName"
          type="text"
          label="Full Name"
          value={fullName}
          onChange={setFullName}
          placeholder=" "
          required
        />

        <FloatingInput
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={email}
          onChange={setEmail}
          placeholder=" "
          required
          error={!emailValid ? "Please enter a valid email address." : ""}
        />

        <PasswordInput
          id="password"
          name="password"
          label="Password"
          value={password}
          onChange={setPassword}
          show={showPassword}
          onToggleShow={() => setShowPassword((prev) => !prev)}
          required
          error={!passwordValid ? "Password must be at least 6 characters." : ""}
        />

        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirmPassword}
          onToggleShow={() => setShowConfirmPassword((prev) => !prev)}
          required
          error={!passwordsMatch ? "Passwords do not match." : ""}
        />

        <button
          type="submit"
          disabled={!formValid || submitting || googleLoading}
          style={{
            ...submitButton,
            background: formValid ? "#1557ff" : "#9db8ff",
            opacity: submitting ? 0.75 : 1,
            cursor: formValid && !submitting ? "pointer" : "not-allowed",
            marginTop: "6px",
          }}
        >
          {submitting ? (
            <span style={buttonInner}>
              <span style={spinnerStyle} />
              Creating account...
            </span>
          ) : (
            "Sign Up"
          )}
        </button>

        <div style={dividerWrap}>
          <div style={dividerLine} />
          <span style={{ color: "#64748b", fontSize: "14px" }}>or</span>
          <div style={dividerLine} />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={googleLoading || submitting}
          style={{
            ...googleButton,
            opacity: googleLoading ? 0.75 : 1,
            cursor: googleLoading ? "not-allowed" : "pointer",
          }}
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

        <div style={footerLinkWrap}>
          Already have an account?{" "}
          <Link href="/login" style={footerLink}>
            Login
          </Link>
        </div>

        <div style={copyrightText}>© JB Collections 2025</div>
      </form>
    </SignupLayout>
  )
}

function SignupPageFallback() {
  return (
    <SignupLayout>
      <div style={{ marginTop: "22px", color: "#64748b", textAlign: "center" }}>
        Loading...
      </div>
    </SignupLayout>
  )
}

function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
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
            }}
          />

          <h1 style={titleStyle}>Create Account</h1>

          <p style={subtitleStyle}>
            Join JB Collections and access premium digital resources.
          </p>
        </div>

        {children}
      </div>
    </main>
  )
}

type FloatingInputProps = {
  inputRef?: React.RefObject<HTMLInputElement | null>
  id: string
  name: string
  type: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  error?: string
}

function FloatingInput({
  inputRef,
  id,
  name,
  type,
  label,
  value,
  onChange,
  placeholder = " ",
  required = false,
  error = "",
}: FloatingInputProps) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={name === "email" ? "email" : name === "fullName" ? "name" : undefined}
          style={{
            ...floatingInputStyle,
            border: error ? "1.5px solid #dc2626" : "1px solid #dbe4ff",
          }}
        />

        <label
          htmlFor={id}
          style={{
            ...floatingLabelStyle,
            top: value ? "10px" : "18px",
            fontSize: value ? "12px" : "16px",
            color: value ? "#1557ff" : "#64748b",
            fontWeight: value ? 700 : 500,
          }}
        >
          {label}
        </label>
      </div>

      {error ? <div style={fieldErrorText}>{error}</div> : null}
    </div>
  )
}

type PasswordInputProps = {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggleShow: () => void
  required?: boolean
  error?: string
}

function PasswordInput({
  id,
  name,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  required = false,
  error = "",
}: PasswordInputProps) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ position: "relative" }}>
        <div
          style={{
            ...passwordWrap,
            border: error ? "1.5px solid #dc2626" : "1px solid #dbe4ff",
          }}
        >
          <input
            id={id}
            name={name}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder=" "
            required={required}
            autoComplete={name === "password" ? "new-password" : "new-password"}
            style={passwordInputStyle}
          />

          <button
            type="button"
            onClick={onToggleShow}
            style={showButton}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>

        <label
          htmlFor={id}
          style={{
            ...floatingLabelStyle,
            top: value ? "10px" : "18px",
            fontSize: value ? "12px" : "16px",
            color: value ? "#1557ff" : "#64748b",
            fontWeight: value ? 700 : 500,
          }}
        >
          {label}
        </label>
      </div>

      {error ? <div style={fieldErrorText}>{error}</div> : null}
    </div>
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
  maxWidth: "500px",
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(14px)",
  borderRadius: "28px",
  boxShadow: "0 24px 55px rgba(0,0,0,0.08)",
  padding: "32px 24px",
  border: "1px solid rgba(255,255,255,0.65)",
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "26px",
  fontWeight: 800,
  color: "#0d1635",
}

const subtitleStyle: CSSProperties = {
  marginTop: "10px",
  marginBottom: 0,
  fontSize: "15px",
  color: "#475569",
  lineHeight: "1.6",
}

const floatingInputStyle: CSSProperties = {
  width: "100%",
  height: "58px",
  borderRadius: "16px",
  outline: "none",
  padding: "22px 16px 8px",
  fontSize: "16px",
  background: "#ffffff",
  color: "#111827",
  boxSizing: "border-box",
}

const floatingLabelStyle: CSSProperties = {
  position: "absolute",
  left: "14px",
  background: "#fff",
  padding: "0 4px",
  transition: "all 0.18s ease",
  pointerEvents: "none",
}

const passwordWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: "58px",
  borderRadius: "16px",
  background: "#ffffff",
  overflow: "hidden",
}

const passwordInputStyle: CSSProperties = {
  flex: 1,
  height: "100%",
  border: "none",
  outline: "none",
  padding: "22px 16px 8px",
  fontSize: "16px",
  background: "transparent",
  color: "#111827",
}

const showButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#1557ff",
  fontWeight: 700,
  fontSize: "14px",
  padding: "0 16px",
  cursor: "pointer",
  height: "100%",
}

const submitButton: CSSProperties = {
  width: "100%",
  height: "56px",
  border: "none",
  borderRadius: "16px",
  color: "#fff",
  fontSize: "17px",
  fontWeight: 700,
  boxShadow: "0 10px 24px rgba(21,87,255,0.24)",
  transition: "0.2s ease",
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
  background: "#ffffff",
  color: "#1557ff",
  fontSize: "15px",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
}

const footerLinkWrap: CSSProperties = {
  marginTop: "22px",
  textAlign: "center",
  fontSize: "14px",
  color: "#475569",
}

const footerLink: CSSProperties = {
  color: "#1557ff",
  fontWeight: 700,
  textDecoration: "none",
}

const copyrightText: CSSProperties = {
  marginTop: "20px",
  textAlign: "center",
  fontSize: "14px",
  color: "#64748b",
}

const fieldErrorText: CSSProperties = {
  marginTop: "8px",
  fontSize: "13px",
  color: "#dc2626",
  fontWeight: 600,
}

const errorBox: CSSProperties = {
  marginBottom: "16px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#fee2e2",
  color: "#991b1b",
  fontSize: "14px",
  fontWeight: 600,
  border: "1px solid #fecaca",
}

const buttonInner: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
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