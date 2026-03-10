"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense, useMemo, useState, type CSSProperties } from "react"
import { useSearchParams } from "next/navigation"

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageContent />
    </Suspense>
  )
}

function SignupPageContent() {
  const searchParams = useSearchParams()
  const error = searchParams?.get("error") ?? ""

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

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

  return (
    <SignupLayout>
      <form method="post" action="/api/auth/signup" style={{ marginTop: "22px" }}>
        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <FloatingInput
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
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder=" "
          required
          error={!emailValid ? "Please enter a valid email address." : ""}
        />

        <FloatingInput
          id="password"
          name="password"
          type="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder=" "
          required
          error={!passwordValid ? "Password must be at least 6 characters." : ""}
        />

        <FloatingInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder=" "
          required
          error={!passwordsMatch ? "Passwords do not match." : ""}
        />

        <button
          type="submit"
          disabled={!formValid}
          style={{
            width: "100%",
            height: "54px",
            border: "none",
            borderRadius: "16px",
            background: formValid ? "#1557ff" : "#9db8ff",
            color: "#fff",
            fontSize: "18px",
            fontWeight: 700,
            cursor: formValid ? "pointer" : "not-allowed",
            boxShadow: "0 10px 24px rgba(21,87,255,0.24)",
            transition: "0.2s ease",
            marginTop: "6px",
          }}
        >
          Sign Up
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            margin: "26px 0",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "#d6def8" }} />
          <span style={{ color: "#64748b", fontSize: "15px" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "#d6def8" }} />
        </div>

        <button type="button" style={googleButton}>
          <span style={{ fontSize: "22px", lineHeight: 1 }}>G</span>
          Continue with Google
        </button>

        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "15px",
            color: "#475569",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: "#1557ff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Login
          </Link>
        </div>

        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "14px",
            color: "#64748b",
          }}
        >
          © JB Collections 2025
        </div>
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
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef2fb 0%, #e8eefc 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(14px)",
          borderRadius: "30px",
          boxShadow: "0 24px 55px rgba(0,0,0,0.08)",
          padding: "40px 38px 34px",
          border: "1px solid rgba(255,255,255,0.65)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <Image
            src="/jb-logo.png"
            alt="JB Collections"
            width={90}
            height={90}
            priority
            style={{
              width: "78px",
              height: "auto",
              margin: "0 auto 14px",
            }}
          />

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#0d1635",
            }}
          >
            Create Account
          </h1>

          <p
            style={{
              marginTop: "12px",
              marginBottom: 0,
              fontSize: "16px",
              color: "#475569",
              lineHeight: "1.7",
            }}
          >
            Join JB Collections and access premium digital resources.
          </p>
        </div>

        {children}
      </div>
    </main>
  )
}

type FloatingInputProps = {
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
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{
            width: "100%",
            height: "58px",
            borderRadius: "16px",
            border: error ? "1.5px solid #dc2626" : "1px solid #dbe4ff",
            outline: "none",
            padding: "22px 16px 8px",
            fontSize: "16px",
            background: "#ffffff",
            color: "#111827",
            boxSizing: "border-box",
          }}
        />

        <label
          htmlFor={id}
          style={{
            position: "absolute",
            left: "14px",
            top: value ? "10px" : "18px",
            fontSize: value ? "12px" : "16px",
            color: value ? "#1557ff" : "#64748b",
            fontWeight: value ? 700 : 500,
            background: "#fff",
            padding: "0 4px",
            transition: "all 0.18s ease",
            pointerEvents: "none",
          }}
        >
          {label}
        </label>
      </div>

      {error && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "13px",
            color: "#dc2626",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

const googleButton: CSSProperties = {
  width: "100%",
  height: "56px",
  borderRadius: "14px",
  border: "2px solid #1557ff",
  background: "#ffffff",
  color: "#1557ff",
  fontSize: "16px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
}