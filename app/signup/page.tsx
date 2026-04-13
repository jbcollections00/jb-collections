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

const REFERRAL_STORAGE_KEY = "jb_referral_code"
const SIGNUP_REWARD = 35

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
  const successParam = searchParams?.get("success") ?? ""
  const refParam = searchParams?.get("ref") ?? ""

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState("")
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [welcomeName, setWelcomeName] = useState("User")
  const [modalVisible, setModalVisible] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [walletCoins, setWalletCoins] = useState<number | null>(null)
  const [bonusConfirmed, setBonusConfirmed] = useState<boolean | null>(null)

  useEffect(() => {
    fullNameRef.current?.focus()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const cleanRef = refParam.trim().toUpperCase()

    if (cleanRef) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, cleanRef)
      document.cookie = `${REFERRAL_STORAGE_KEY}=${encodeURIComponent(cleanRef)}; path=/; max-age=2592000; samesite=lax`
      setReferralCode(cleanRef)
      return
    }

    const savedRef = localStorage.getItem(REFERRAL_STORAGE_KEY) || ""
    setReferralCode(savedRef.trim().toUpperCase())
  }, [refParam])

  useEffect(() => {
    let cancelled = false

    async function loadWalletPreview() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user?.id || cancelled) return

        const [{ data: profile }, { data: history }] = await Promise.all([
          supabase
            .from("profiles")
            .select("coins")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("coin_history")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "signup_bonus")
            .limit(1),
        ])

        if (cancelled) return

        setWalletCoins(profile?.coins ?? null)
        setBonusConfirmed(Boolean(history && history.length > 0))
      } catch {
        if (!cancelled) {
          setWalletCoins(null)
          setBonusConfirmed(null)
        }
      }
    }

    if (successParam === "true" || successParam === "account-created") {
      const savedName =
        typeof window !== "undefined"
          ? sessionStorage.getItem("signupFullName")
          : null

      const finalName = savedName?.trim() || "User"

      setWelcomeName(finalName)
      setCountdown(3)
      setShowWelcomeModal(true)
      loadWalletPreview()

      const enterTimer = setTimeout(() => {
        setModalVisible(true)
      }, 30)

      let secondsLeft = 3

      const countdownTimer = setInterval(() => {
        secondsLeft -= 1
        if (secondsLeft >= 0) {
          setCountdown(secondsLeft)
        }
      }, 1000)

      const redirectTimer = setTimeout(() => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("signupFullName")
          localStorage.removeItem(REFERRAL_STORAGE_KEY)
          document.cookie = `${REFERRAL_STORAGE_KEY}=; path=/; max-age=0; samesite=lax`
          window.location.href = "/dashboard"
        }
      }, 3000)

      return () => {
        cancelled = true
        clearTimeout(enterTimer)
        clearTimeout(redirectTimer)
        clearInterval(countdownTimer)
      }
    }

    return () => {
      cancelled = true
    }
  }, [successParam, supabase])

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

    if (errorParam === "referral-code-failed") {
      return "Could not create your referral code. Please try again."
    }

    if (errorParam === "reward-failed") {
      return "Your account was created, but the reward popup may not match your final wallet balance yet."
    }

    if (errorParam === "profile-save-failed") {
      return "Your account was created, but your profile could not be saved properly."
    }

    if (errorParam === "signup-failed" || errorParam === "failed") {
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

  const referralActive = referralCode.trim().length > 0

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

    if (typeof window !== "undefined") {
      sessionStorage.setItem("signupFullName", fullName.trim())

      const cleanRef = referralCode.trim().toUpperCase()
      if (cleanRef) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, cleanRef)
        document.cookie = `${REFERRAL_STORAGE_KEY}=${encodeURIComponent(cleanRef)}; path=/; max-age=2592000; samesite=lax`
      }
    }

    setSubmitting(true)
  }

  async function handleGoogleSignup() {
    try {
      setGoogleError("")
      setGoogleLoading(true)

      const origin = window.location.origin
      const cleanRef = referralCode.trim().toUpperCase()

      if (cleanRef) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, cleanRef)
        document.cookie = `${REFERRAL_STORAGE_KEY}=${encodeURIComponent(cleanRef)}; path=/; max-age=2592000; samesite=lax`
      }

      const redirectTo = cleanRef
        ? `${origin}/api/auth/callback?ref=${encodeURIComponent(cleanRef)}`
        : `${origin}/api/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
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

  const walletLabel =
    walletCoins === null ? "Preparing wallet..." : `${walletCoins} JB Coins`

  const bonusLabel =
    bonusConfirmed === null
      ? "Checking reward status..."
      : bonusConfirmed
        ? "Signup bonus confirmed"
        : `Welcome reward pending review`

  return (
    <SignupLayout>
      {showWelcomeModal ? (
        <div
          style={{
            ...modalOverlayStyle,
            opacity: modalVisible ? 1 : 0,
            pointerEvents: modalVisible ? "auto" : "none",
          }}
        >
          <div
            style={{
              ...modalCardStyle,
              opacity: modalVisible ? 1 : 0,
              transform: modalVisible
                ? "translateY(0px) scale(1)"
                : "translateY(18px) scale(0.96)",
            }}
          >
            <div style={rewardGlowStyle} />
            <div style={successIconStyle}>✓</div>

            <div style={rewardBadgeStyle}>
              <span style={rewardBadgeIconStyle}>🪙</span>
              <span>{bonusConfirmed ? `+${SIGNUP_REWARD} JB Coins Added` : "Wallet setup in progress"}</span>
            </div>

            <div style={coinBurstWrapStyle} aria-hidden="true">
              <span style={{ ...coinBurstItemStyle, left: "8%", animationDelay: "0s" }}>🪙</span>
              <span style={{ ...coinBurstItemStyle, left: "24%", animationDelay: "0.35s" }}>✨</span>
              <span style={{ ...coinBurstItemStyle, left: "40%", animationDelay: "0.15s" }}>🪙</span>
              <span style={{ ...coinBurstItemStyle, left: "58%", animationDelay: "0.45s" }}>✨</span>
              <span style={{ ...coinBurstItemStyle, left: "74%", animationDelay: "0.2s" }}>🪙</span>
              <span style={{ ...coinBurstItemStyle, left: "88%", animationDelay: "0.5s" }}>✨</span>
            </div>

            <h2 style={modalTitleStyle}>Welcome, {welcomeName}! 🎉</h2>

            <p style={modalTextStyle}>
              Your account has been successfully created.
            </p>

            <div style={rewardPanelStyle}>
              <div style={rewardPanelLabelStyle}>Wallet Balance</div>
              <div style={rewardPanelValueStyle}>{walletLabel}</div>
              <div style={rewardPanelSubStyle}>{bonusLabel}</div>
            </div>

            <div style={modalButtonRowStyle}>
              <button
                type="button"
                style={dashboardButtonStyle}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    sessionStorage.removeItem("signupFullName")
                    localStorage.removeItem(REFERRAL_STORAGE_KEY)
                    document.cookie = `${REFERRAL_STORAGE_KEY}=; path=/; max-age=0; samesite=lax`
                    window.location.href = "/dashboard"
                  }
                }}
              >
                Go to Dashboard
              </button>
            </div>

            <p style={modalSubTextStyle}>
              Redirecting you to your dashboard in {countdown} second
              {countdown === 1 ? "" : "s"}.
            </p>

            <div style={modalAdminTextStyle}>— Admin</div>
          </div>
        </div>
      ) : null}

      <div style={heroWrapStyle}>
        <div style={heroBadgeStyle}>New account bonus unlocked</div>
        <h2 style={heroTitleStyle}>Start strong on JB Collections</h2>
        <p style={heroTextStyle}>
          Create your account, claim your free {SIGNUP_REWARD} JB Coins, and unlock a smoother premium-style experience from day one.
        </p>

        <div style={heroStatsGridStyle}>
          <div style={heroStatCardStyle}>
            <div style={heroStatValueStyle}>+{SIGNUP_REWARD}</div>
            <div style={heroStatLabelStyle}>JB Coins</div>
          </div>
          <div style={heroStatCardStyle}>
            <div style={heroStatValueStyle}>Fast</div>
            <div style={heroStatLabelStyle}>Signup flow</div>
          </div>
          <div style={heroStatCardStyle}>
            <div style={heroStatValueStyle}>Secure</div>
            <div style={heroStatLabelStyle}>Wallet setup</div>
          </div>
        </div>
      </div>

      <form
        method="post"
        action="/api/auth/signup"
        onSubmit={handleSubmit}
        style={{ marginTop: "20px" }}
      >
        <input type="hidden" name="referralCode" value={referralCode} readOnly />

        {referralActive ? (
          <div style={referralBannerStyle}>
            <span style={{ fontSize: 18 }}>🎁</span>
            <div>
              <div style={referralBannerTitleStyle}>Referral code detected</div>
              <div style={referralBannerTextStyle}>{referralCode}</div>
            </div>
          </div>
        ) : null}

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

        <div style={helperRowStyle}>
          <span style={helperChipStyle}>✓ 6+ characters</span>
          <span style={helperChipStyle}>✓ secure account</span>
          <span style={helperChipStyle}>✓ bonus ready</span>
        </div>

        <button
          type="submit"
          disabled={!formValid || submitting || googleLoading}
          style={{
            ...submitButton,
            background: formValid ? "linear-gradient(135deg, #1557ff 0%, #3b82f6 100%)" : "#9db8ff",
            opacity: submitting ? 0.78 : 1,
            cursor:
              formValid && !submitting && !googleLoading
                ? "pointer"
                : "not-allowed",
            marginTop: "6px",
          }}
        >
          {submitting ? (
            <span style={buttonInner}>
              <span style={spinnerStyle} />
              Creating account...
            </span>
          ) : (
            <span style={buttonInner}>
              <span>Create account</span>
              <span>→</span>
            </span>
          )}
        </button>

        <div style={dividerWrap}>
          <div style={dividerLine} />
          <span style={{ color: "#64748b", fontSize: "14px" }}>or continue with</span>
          <div style={dividerLine} />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={googleLoading || submitting}
          style={{
            ...googleButton,
            opacity: googleLoading ? 0.75 : 1,
            cursor: googleLoading || submitting ? "not-allowed" : "pointer",
          }}
        >
          {googleLoading ? (
            <span style={buttonInner}>
              <span style={spinnerBlueStyle} />
              Redirecting...
            </span>
          ) : (
            <>
              <Image src="/google.svg" alt="Google" width={20} height={20} />
              Continue with Google
            </>
          )}
        </button>

        <div style={trustRowStyle}>
          <span style={trustChipStyle}>🔐 Secure signup</span>
          <span style={trustChipStyle}>⚡ Fast access</span>
          <span style={trustChipStyle}>🪙 Reward ready</span>
        </div>

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
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes coin-float {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.8);
          }
          15% {
            opacity: 1;
          }
          50% {
            opacity: 1;
            transform: translateY(-16px) scale(1.06);
          }
          100% {
            opacity: 0;
            transform: translateY(-42px) scale(0.88);
          }
        }

        @keyframes reward-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.35);
          }
          70% {
            transform: scale(1.02);
            box-shadow: 0 0 0 16px rgba(250, 204, 21, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(250, 204, 21, 0);
          }
        }
      `}</style>

      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <div style={logoWrapStyle}>
            <Image
              src="/jb-logo.png"
              alt="JB Collections"
              width={76}
              height={76}
              priority
              style={{
                width: "76px",
                height: "76px",
                borderRadius: "20px",
              }}
            />
          </div>

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
          autoComplete={
            name === "email" ? "email" : name === "fullName" ? "name" : undefined
          }
          style={{
            ...floatingInputStyle,
            border: error ? "1.5px solid #dc2626" : "1px solid #dbe4ff",
            boxShadow: error ? "0 0 0 4px rgba(220,38,38,0.08)" : "0 8px 20px rgba(21,87,255,0.05)",
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
            boxShadow: error ? "0 0 0 4px rgba(220,38,38,0.08)" : "0 8px 20px rgba(21,87,255,0.05)",
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
            autoComplete="new-password"
            style={passwordInputStyle}
          />

          <button type="button" onClick={onToggleShow} style={showButton}>
            {show ? "🙈" : "👁️"}
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
  background:
    "radial-gradient(circle at top, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0) 28%), linear-gradient(180deg, #eef4ff 0%, #eef2fb 42%, #e8eefc 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
}

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  borderRadius: "30px",
  boxShadow: "0 30px 80px rgba(15,23,42,0.10)",
  padding: "34px 24px 28px",
  border: "1px solid rgba(255,255,255,0.78)",
}

const logoWrapStyle: CSSProperties = {
  width: "94px",
  height: "94px",
  borderRadius: "28px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.65))",
  border: "1px solid rgba(21,87,255,0.08)",
  display: "grid",
  placeItems: "center",
  margin: "0 auto 16px",
  boxShadow: "0 18px 40px rgba(21,87,255,0.12)",
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "28px",
  fontWeight: 900,
  color: "#0d1635",
  letterSpacing: "-0.02em",
}

const subtitleStyle: CSSProperties = {
  marginTop: "10px",
  marginBottom: 0,
  fontSize: "15px",
  color: "#475569",
  lineHeight: "1.7",
}

const heroWrapStyle: CSSProperties = {
  marginTop: "10px",
  marginBottom: "18px",
  padding: "18px",
  borderRadius: "24px",
  background: "linear-gradient(135deg, #0f172a 0%, #1557ff 58%, #60a5fa 100%)",
  color: "#ffffff",
  boxShadow: "0 22px 46px rgba(21,87,255,0.22)",
}

const heroBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}

const heroTitleStyle: CSSProperties = {
  margin: "14px 0 0",
  fontSize: "28px",
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: "-0.03em",
}

const heroTextStyle: CSSProperties = {
  marginTop: "12px",
  marginBottom: 0,
  color: "rgba(255,255,255,0.88)",
  fontSize: "15px",
  lineHeight: 1.7,
}

const heroStatsGridStyle: CSSProperties = {
  marginTop: "18px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "10px",
}

const heroStatCardStyle: CSSProperties = {
  borderRadius: "18px",
  padding: "14px 12px",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.14)",
}

const heroStatValueStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 900,
  lineHeight: 1.1,
}

const heroStatLabelStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "13px",
  color: "rgba(255,255,255,0.82)",
}

const referralBannerStyle: CSSProperties = {
  marginBottom: "16px",
  borderRadius: "16px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "linear-gradient(180deg, #fff9db 0%, #fff2b8 100%)",
  border: "1px solid rgba(245, 158, 11, 0.24)",
  color: "#7c5100",
}

const referralBannerTitleStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
}

const referralBannerTextStyle: CSSProperties = {
  marginTop: "2px",
  fontSize: "14px",
  fontWeight: 700,
}

const floatingInputStyle: CSSProperties = {
  width: "100%",
  height: "60px",
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
  height: "60px",
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

const helperRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "2px",
  marginBottom: "14px",
}

const helperChipStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: "999px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: 700,
  border: "1px solid #dbeafe",
}

const submitButton: CSSProperties = {
  width: "100%",
  height: "58px",
  border: "none",
  borderRadius: "18px",
  color: "#fff",
  fontSize: "17px",
  fontWeight: 800,
  boxShadow: "0 16px 34px rgba(21,87,255,0.28)",
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
  height: "56px",
  borderRadius: "16px",
  border: "2px solid #1557ff",
  background: "#ffffff",
  color: "#1557ff",
  fontSize: "15px",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  boxShadow: "0 10px 24px rgba(21,87,255,0.08)",
}

const trustRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "16px",
  justifyContent: "center",
}

const trustChipStyle: CSSProperties = {
  padding: "9px 12px",
  borderRadius: "999px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: "12px",
  fontWeight: 700,
  border: "1px solid #e2e8f0",
}

const footerLinkWrap: CSSProperties = {
  marginTop: "22px",
  textAlign: "center",
  fontSize: "14px",
  color: "#475569",
}

const footerLink: CSSProperties = {
  color: "#1557ff",
  fontWeight: 800,
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
  fontWeight: 700,
}

const errorBox: CSSProperties = {
  marginBottom: "16px",
  padding: "13px 14px",
  borderRadius: "14px",
  background: "#fee2e2",
  color: "#991b1b",
  fontSize: "14px",
  fontWeight: 700,
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

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 9999,
  transition: "opacity 0.35s ease",
}

const modalCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  borderRadius: "28px",
  padding: "30px 24px",
  boxShadow: "0 30px 80px rgba(0,0,0,0.18)",
  textAlign: "center",
  transition: "all 0.35s ease",
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.85)",
}

const rewardGlowStyle: CSSProperties = {
  position: "absolute",
  top: "-90px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "220px",
  height: "220px",
  borderRadius: "999px",
  background:
    "radial-gradient(circle, rgba(250,204,21,0.35) 0%, rgba(250,204,21,0) 72%)",
  pointerEvents: "none",
}

const successIconStyle: CSSProperties = {
  width: "74px",
  height: "74px",
  margin: "0 auto 14px",
  borderRadius: "999px",
  background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "34px",
  fontWeight: 800,
  boxShadow: "0 14px 30px rgba(34,197,94,0.28)",
  position: "relative",
  zIndex: 2,
}

const rewardBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "10px 16px",
  borderRadius: "999px",
  background: "linear-gradient(180deg, #fff7cc 0%, #ffe48a 100%)",
  color: "#8a5a00",
  fontWeight: 800,
  fontSize: "14px",
  border: "1px solid rgba(245, 158, 11, 0.35)",
  boxShadow: "0 10px 24px rgba(250, 204, 21, 0.22)",
  animation: "reward-pulse 1.8s ease-in-out infinite",
  position: "relative",
  zIndex: 2,
}

const rewardBadgeIconStyle: CSSProperties = {
  fontSize: "16px",
  lineHeight: 1,
}

const coinBurstWrapStyle: CSSProperties = {
  position: "relative",
  height: "44px",
  marginTop: "12px",
  marginBottom: "2px",
  overflow: "hidden",
}

const coinBurstItemStyle: CSSProperties = {
  position: "absolute",
  bottom: "0",
  fontSize: "20px",
  lineHeight: 1,
  animation: "coin-float 1.8s ease-in-out infinite",
  opacity: 0,
}

const modalTitleStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: "28px",
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.2,
  position: "relative",
  zIndex: 2,
}

const modalTextStyle: CSSProperties = {
  marginTop: "14px",
  marginBottom: 0,
  fontSize: "16px",
  color: "#334155",
  lineHeight: 1.6,
  position: "relative",
  zIndex: 2,
}

const rewardPanelStyle: CSSProperties = {
  marginTop: "16px",
  borderRadius: "22px",
  padding: "16px 18px",
  background: "linear-gradient(180deg, #fff9db 0%, #fff2b8 100%)",
  border: "1px solid rgba(245, 158, 11, 0.22)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  position: "relative",
  zIndex: 2,
}

const rewardPanelLabelStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#a16207",
}

const rewardPanelValueStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "30px",
  lineHeight: 1.1,
  fontWeight: 900,
  color: "#7c5100",
}

const rewardPanelSubStyle: CSSProperties = {
  marginTop: "8px",
  fontSize: "14px",
  lineHeight: 1.5,
  color: "#8a5a00",
}

const modalButtonRowStyle: CSSProperties = {
  marginTop: "16px",
  display: "flex",
  justifyContent: "center",
}

const dashboardButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: "14px",
  height: "46px",
  padding: "0 18px",
  background: "linear-gradient(135deg, #1557ff 0%, #3b82f6 100%)",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(21,87,255,0.24)",
}

const modalSubTextStyle: CSSProperties = {
  marginTop: "14px",
  marginBottom: 0,
  fontSize: "15px",
  color: "#64748b",
  lineHeight: 1.6,
  position: "relative",
  zIndex: 2,
}

const modalAdminTextStyle: CSSProperties = {
  marginTop: "18px",
  fontSize: "14px",
  fontWeight: 700,
  color: "#1557ff",
  position: "relative",
  zIndex: 2,
}
