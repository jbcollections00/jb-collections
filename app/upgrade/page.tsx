"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AdSlot from "@/app/components/AdSlot"
import SiteHeader from "@/app/components/SiteHeader"
import { IN_CONTENT_AD } from "@/app/lib/adCodes"

function normalizePlan(value?: string | null) {
  const plan = String(value || "").trim().toLowerCase()
  if (plan === "platinum") return "platinum"
  return "premium"
}

type ProfileRow = {
  id?: string
  full_name?: string | null
  name?: string | null
  membership?: string | null
  jb_points?: number | null
  role?: string | null
  is_premium?: boolean | null
}

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function UpgradePageContent() {
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const success = searchParams?.get("success") ?? ""
  const error = searchParams?.get("error") ?? ""
  const initialPlan = normalizePlan(searchParams?.get("plan") ?? "")

  const [selectedPlan, setSelectedPlan] = useState<"premium" | "platinum">(initialPlan)
  const [showPaymentBox, setShowPaymentBox] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<"gcash" | "maya" | "bank">("gcash")
  const [selectedMethod, setSelectedMethod] = useState<"payment" | "coins">("coins")
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const premiumCoinCost = 2000
  const platinumCoinCost = 2600

  useEffect(() => {
    void loadProfile()
  }, [])

  async function loadProfile() {
    try {
      setProfileLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setProfile(null)
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, name, membership, jb_points, role, is_premium")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        console.error("Upgrade profile fetch error:", error)
        setProfile(null)
        return
      }

      setProfile((data as ProfileRow | null) || null)
    } catch (err) {
      console.error("Upgrade profile load error:", err)
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  const membership = normalizeMembership(profile?.membership)
  const currentCoins = Number(profile?.jb_points || 0)
  const selectedCoinCost = selectedPlan === "platinum" ? platinumCoinCost : premiumCoinCost
  const hasEnoughCoins = currentCoins >= selectedCoinCost
  const planTitle = selectedPlan === "platinum" ? "Platinum" : "Premium"
  const planPrice = selectedPlan === "platinum" ? "₱299" : "₱149"
  const planCoinCost = selectedPlan === "platinum" ? platinumCoinCost : premiumCoinCost
  const planGradient =
    selectedPlan === "platinum"
      ? "linear-gradient(90deg, #d946ef, #8b5cf6)"
      : "linear-gradient(90deg, #38bdf8, #4f46e5)"
  const formDefaultSubject =
    selectedPlan === "platinum"
      ? "Platinum upgrade request"
      : "Premium upgrade request"

  const successText =
    success === "redeemed"
      ? selectedPlan === "platinum"
        ? "Your Platinum membership was redeemed successfully using JB Coins."
        : "Your Premium membership was redeemed successfully using JB Coins."
      : selectedPlan === "platinum"
        ? "Your platinum upgrade request was submitted successfully."
        : "Your premium upgrade request was submitted successfully."

  const errorMessage =
    error === "missing-message"
      ? "Please enter your upgrade reason."
      : error === "missing-payment-name"
        ? "Please enter the account name used for payment."
        : error === "missing-payment-method"
          ? "Please select a payment method."
          : error === "missing-reference-number"
            ? "Please enter the payment reference number."
            : error === "missing-receipt"
              ? "Please upload your payment receipt."
              : error === "file-too-large"
                ? "Receipt file is too large. Maximum size is 10MB."
                : error === "invalid-file-type"
                  ? "Invalid receipt file type. Please upload JPG, PNG, WEBP, or PDF."
                  : error === "upload-failed"
                    ? "Receipt upload failed. Please try again."
                    : error === "insert-failed"
                      ? "Failed to save your request. Please try again."
                      : error === "insufficient-coins"
                        ? "You do not have enough JB Coins to redeem this membership."
                        : error === "already-premium"
                          ? "Your account already has Premium or higher access."
                          : error === "already-platinum"
                            ? "Your account already has Platinum access."
                            : error === "auth-required"
                              ? "Please log in first before redeeming with JB Coins."
                              : error === "redeem-failed"
                                ? "Redeem failed. Please try again."
                                : error === "unexpected"
                                  ? "Something went wrong. Please try again."
                                  : null

  const paymentDetails = useMemo(() => {
    if (selectedPayment === "gcash") {
      return {
        label: "GCash",
        qr: "/gcash-qr.jpg",
        numberLabel: "Mobile Number",
        number: "09685289257",
        name: "JONATHAN BARRUGA",
        extra: "",
      }
    }

    if (selectedPayment === "maya") {
      return {
        label: "Maya",
        qr: "/maya-qr.jpg",
        numberLabel: "Mobile Number",
        number: "09685289257",
        name: "JONATHAN BARRUGA",
        extra: "",
      }
    }

    return {
      label: "Bank / InstaPay",
      qr: "/maribank-qr.jpg",
      numberLabel: "Account Number",
      number: "18011936146",
      name: "JONATHAN BARRUGA",
      extra: "SWIFT/BIC: LAUIPHM2 / LAUIPHM2XXX",
    }
  }, [selectedPayment])

  function choosePlan(plan: "premium" | "platinum", method: "payment" | "coins") {
    setSelectedPlan(plan)
    setSelectedMethod(method)
    setShowPaymentBox(true)

    setTimeout(() => {
      const el = document.getElementById("payment-section")
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 100)
  }

  const isAlreadyPremiumOrHigher =
    membership === "premium" || membership === "platinum"
  const isAlreadyPlatinum = membership === "platinum"

  const disablePremiumRedeem =
    profileLoading || !profile || currentCoins < premiumCoinCost || isAlreadyPremiumOrHigher

  const disablePlatinumRedeem =
    profileLoading || !profile || currentCoins < platinumCoinCost || isAlreadyPlatinum

  const coinsNeededForPremium = Math.max(0, premiumCoinCost - currentCoins)
  const coinsNeededForPlatinum = Math.max(0, platinumCoinCost - currentCoins)

  const pageCardStyle: React.CSSProperties = {
    border: "1px solid rgba(148, 163, 184, 0.16)",
    background: "rgba(15, 23, 42, 0.78)",
    borderRadius: "24px",
    boxShadow: "0 20px 45px rgba(2, 6, 23, 0.34)",
    backdropFilter: "blur(10px)",
  }

  const mutedText: React.CSSProperties = {
    color: "#94a3b8",
  }

  return (
    <>
      <SiteHeader />

      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 22%), radial-gradient(circle at top right, rgba(217,70,239,0.14), transparent 24%), linear-gradient(180deg, #020617 0%, #0f172a 42%, #111827 100%)",
          padding: "100px 14px 24px",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: "1400px", margin: "0 auto" }}>
          <div
            style={{
              ...pageCardStyle,
              overflow: "hidden",
              padding: "28px 20px",
              marginBottom: "22px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  selectedPlan === "platinum"
                    ? "linear-gradient(135deg, rgba(217,70,239,0.12), rgba(139,92,246,0.02))"
                    : "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(79,70,229,0.02))",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "relative",
                zIndex: 1,
                textAlign: "center",
                maxWidth: "900px",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  marginBottom: "14px",
                  padding: "8px 15px",
                  borderRadius: "999px",
                  background:
                    selectedPlan === "platinum"
                      ? "rgba(217,70,239,0.14)"
                      : "rgba(59,130,246,0.16)",
                  border:
                    selectedPlan === "platinum"
                      ? "1px solid rgba(217,70,239,0.25)"
                      : "1px solid rgba(59,130,246,0.24)",
                  color: selectedPlan === "platinum" ? "#f0abfc" : "#93c5fd",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.6px",
                }}
              >
                MEMBERSHIP UPGRADE
              </div>

              <h1
                style={{
                  margin: "0 0 14px",
                  fontSize: "clamp(30px, 5vw, 48px)",
                  lineHeight: 1.1,
                  color: "#f8fafc",
                  fontWeight: 800,
                }}
              >
                Unlock More Downloads with JB Collections
              </h1>

              <p
                style={{
                  margin: "0 auto",
                  maxWidth: "760px",
                  fontSize: "16px",
                  lineHeight: 1.8,
                  color: "#cbd5e1",
                }}
              >
                Upgrade your account to access premium files, faster downloads,
                and exclusive Platinum-only releases. You can upgrade either by
                paying directly or by redeeming your saved JB Coins.
              </p>

              <div
                style={{
                  marginTop: "18px",
                  display: "flex",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                {[
                  "Instant redeem with JB Coins",
                  "Manual payment review",
                  "Secure receipt upload",
                  "Premium and Platinum access",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "999px",
                      background: "rgba(15, 23, 42, 0.7)",
                      border: "1px solid rgba(148, 163, 184, 0.14)",
                      color: "#e2e8f0",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              ...pageCardStyle,
              padding: "18px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.12)",
                  borderRadius: "18px",
                  background: "rgba(2, 6, 23, 0.35)",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#94a3b8",
                    marginBottom: "8px",
                    letterSpacing: "0.4px",
                  }}
                >
                  CURRENT MEMBERSHIP
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#f8fafc",
                  }}
                >
                  {membership === "platinum"
                    ? "Platinum"
                    : membership === "premium"
                      ? "Premium"
                      : "Free"}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.12)",
                  borderRadius: "18px",
                  background: "rgba(2, 6, 23, 0.35)",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#94a3b8",
                    marginBottom: "8px",
                    letterSpacing: "0.4px",
                  }}
                >
                  JB COIN WALLET
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#f8fafc",
                  }}
                >
                  {profileLoading ? "Loading..." : `${currentCoins.toLocaleString()} JB Coins`}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.12)",
                  borderRadius: "18px",
                  background: "rgba(2, 6, 23, 0.35)",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#94a3b8",
                    marginBottom: "8px",
                    letterSpacing: "0.4px",
                  }}
                >
                  NEED FOR PREMIUM
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: coinsNeededForPremium === 0 ? "#4ade80" : "#f8fafc",
                  }}
                >
                  {profileLoading
                    ? "Loading..."
                    : coinsNeededForPremium === 0
                      ? "Ready"
                      : `${coinsNeededForPremium.toLocaleString()} more`}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.12)",
                  borderRadius: "18px",
                  background: "rgba(2, 6, 23, 0.35)",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#94a3b8",
                    marginBottom: "8px",
                    letterSpacing: "0.4px",
                  }}
                >
                  NEED FOR PLATINUM
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: coinsNeededForPlatinum === 0 ? "#e879f9" : "#f8fafc",
                  }}
                >
                  {profileLoading
                    ? "Loading..."
                    : coinsNeededForPlatinum === 0
                      ? "Ready"
                      : `${coinsNeededForPlatinum.toLocaleString()} more`}
                </div>
              </div>
            </div>
          </div>

          {success === "1" || success === "redeemed" ? (
            <div
              style={{
                marginBottom: "18px",
                border: "1px solid rgba(74, 222, 128, 0.30)",
                background: "rgba(20, 83, 45, 0.34)",
                color: "#86efac",
                borderRadius: "16px",
                padding: "14px 16px",
                fontSize: "14px",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {successText}
            </div>
          ) : null}

          {errorMessage && (
            <div
              style={{
                marginBottom: "18px",
                border: "1px solid rgba(248, 113, 113, 0.28)",
                background: "rgba(127, 29, 29, 0.34)",
                color: "#fca5a5",
                borderRadius: "16px",
                padding: "14px 16px",
                fontSize: "14px",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {errorMessage}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
              gap: "18px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                ...pageCardStyle,
                padding: "24px",
                background: "rgba(15, 23, 42, 0.82)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#94a3b8",
                  marginBottom: "10px",
                  letterSpacing: "0.5px",
                }}
              >
                FREE
              </div>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 800,
                  color: "#f8fafc",
                  marginBottom: "4px",
                }}
              >
                ₱0
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#94a3b8",
                  marginBottom: "18px",
                }}
              >
                basic access
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  fontSize: "14px",
                  color: "#cbd5e1",
                  lineHeight: 1.6,
                }}
              >
                <div>✔ Access free files</div>
                <div>✔ Browse all categories</div>
                <div>✖ Sponsored step on free downloads</div>
                <div>✖ No premium files</div>
                <div>✖ No platinum files</div>
              </div>
            </div>

            <div
              style={{
                ...pageCardStyle,
                padding: "24px",
                position: "relative",
                border:
                  selectedPlan === "premium"
                    ? "2px solid rgba(96, 165, 250, 0.90)"
                    : "1px solid rgba(96, 165, 250, 0.20)",
                background:
                  "linear-gradient(180deg, rgba(30,41,59,0.96) 0%, rgba(15,23,42,0.92) 100%)",
                boxShadow: "0 22px 50px rgba(37, 99, 235, 0.18)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-11px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(90deg, #2563eb, #38bdf8)",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.4px",
                }}
              >
                MOST POPULAR
              </div>

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#93c5fd",
                  marginBottom: "10px",
                  letterSpacing: "0.5px",
                }}
              >
                PREMIUM
              </div>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 800,
                  color: "#f8fafc",
                  marginBottom: "4px",
                }}
              >
                ₱149
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#94a3b8",
                  marginBottom: "14px",
                }}
              >
                per month
              </div>

              <div
                style={{
                  marginBottom: "18px",
                  border: "1px solid rgba(96,165,250,0.20)",
                  background: "rgba(37, 99, 235, 0.10)",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#93c5fd",
                    marginBottom: "4px",
                  }}
                >
                  REDEEM WITH JB COINS
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#f8fafc",
                  }}
                >
                  {premiumCoinCost.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#cbd5e1",
                    marginTop: "4px",
                  }}
                >
                  JB Coins
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  fontSize: "14px",
                  color: "#cbd5e1",
                  lineHeight: 1.6,
                }}
              >
                <div>✔ Access premium files</div>
                <div>✔ Direct downloads</div>
                <div>✔ No sponsored step on premium/free files</div>
                <div>✔ Faster experience</div>
                <div>✖ No platinum-exclusive files</div>
              </div>

              <div style={{ marginTop: "18px", display: "grid", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => choosePlan("premium", "coins")}
                  disabled={disablePremiumRedeem}
                  style={{
                    display: "inline-flex",
                    width: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "13px 18px",
                    borderRadius: "14px",
                    background: disablePremiumRedeem
                      ? "rgba(100, 116, 139, 0.5)"
                      : "linear-gradient(90deg, #2563eb, #38bdf8)",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: "none",
                    cursor: disablePremiumRedeem ? "not-allowed" : "pointer",
                  }}
                >
                  {isAlreadyPremiumOrHigher
                    ? "Already Premium or Higher"
                    : profileLoading
                      ? "Checking Coins..."
                      : currentCoins < premiumCoinCost
                        ? "Not Enough JB Coins"
                        : "Redeem Premium with JB Coins"}
                </button>

                <button
                  type="button"
                  onClick={() => choosePlan("premium", "payment")}
                  style={{
                    display: "inline-flex",
                    width: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "13px 18px",
                    borderRadius: "14px",
                    background: "rgba(15, 23, 42, 0.8)",
                    color: "#e2e8f0",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: "1px solid rgba(96,165,250,0.28)",
                    cursor: "pointer",
                  }}
                >
                  Choose Premium via Payment
                </button>
              </div>
            </div>

            <div
              style={{
                ...pageCardStyle,
                padding: "24px",
                position: "relative",
                border:
                  selectedPlan === "platinum"
                    ? "2px solid rgba(232, 121, 249, 0.90)"
                    : "1px solid rgba(232, 121, 249, 0.22)",
                background:
                  "linear-gradient(180deg, rgba(45,17,67,0.92) 0%, rgba(30,27,75,0.90) 100%)",
                boxShadow: "0 24px 54px rgba(168, 85, 247, 0.22)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-11px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(90deg, #d946ef, #8b5cf6)",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.4px",
                }}
              >
                BEST FOR EXCLUSIVES
              </div>

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#f0abfc",
                  marginBottom: "10px",
                  letterSpacing: "0.5px",
                }}
              >
                PLATINUM
              </div>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 800,
                  color: "#f8fafc",
                  marginBottom: "4px",
                }}
              >
                ₱299
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#c4b5fd",
                  marginBottom: "14px",
                }}
              >
                per month
              </div>

              <div
                style={{
                  marginBottom: "18px",
                  border: "1px solid rgba(232,121,249,0.22)",
                  background: "rgba(217, 70, 239, 0.10)",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#f0abfc",
                    marginBottom: "4px",
                  }}
                >
                  REDEEM WITH JB COINS
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#f8fafc",
                  }}
                >
                  {platinumCoinCost.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#e9d5ff",
                    marginTop: "4px",
                  }}
                >
                  JB Coins
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  fontSize: "14px",
                  color: "#e9d5ff",
                  lineHeight: 1.6,
                }}
              >
                <div>✔ Everything in Premium</div>
                <div>✔ Access platinum-exclusive files</div>
                <div>✔ Highest access level</div>
                <div>✔ Best for exclusive releases</div>
                <div>✔ Premium + Platinum content</div>
              </div>

              <div style={{ marginTop: "18px", display: "grid", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => choosePlan("platinum", "coins")}
                  disabled={disablePlatinumRedeem}
                  style={{
                    display: "inline-flex",
                    width: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "13px 18px",
                    borderRadius: "14px",
                    background: disablePlatinumRedeem
                      ? "rgba(126, 34, 206, 0.40)"
                      : "linear-gradient(90deg, #d946ef, #8b5cf6)",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: "none",
                    cursor: disablePlatinumRedeem ? "not-allowed" : "pointer",
                  }}
                >
                  {isAlreadyPlatinum
                    ? "Already Platinum"
                    : profileLoading
                      ? "Checking Coins..."
                      : currentCoins < platinumCoinCost
                        ? "Not Enough JB Coins"
                        : "Redeem Platinum with JB Coins"}
                </button>

                <button
                  type="button"
                  onClick={() => choosePlan("platinum", "payment")}
                  style={{
                    display: "inline-flex",
                    width: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "13px 18px",
                    borderRadius: "14px",
                    background: "rgba(30, 27, 75, 0.86)",
                    color: "#f5d0fe",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: "1px solid rgba(232,121,249,0.28)",
                    cursor: "pointer",
                  }}
                >
                  Choose Platinum via Payment
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              ...pageCardStyle,
              padding: "16px",
              marginBottom: "24px",
              overflow: "hidden",
            }}
          >
            <AdSlot code={IN_CONTENT_AD} />
          </div>

          {showPaymentBox ? (
            <div
              id="payment-section"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: "24px",
              }}
            >
              {selectedMethod === "coins" ? (
                <div
                  style={{
                    ...pageCardStyle,
                    padding: "22px",
                  }}
                >
                  <div
                    style={{
                      border:
                        selectedPlan === "platinum"
                          ? "1px solid rgba(232,121,249,0.26)"
                          : "1px solid rgba(96,165,250,0.24)",
                      background:
                        selectedPlan === "platinum"
                          ? "rgba(217,70,239,0.10)"
                          : "rgba(37,99,235,0.10)",
                      borderRadius: "18px",
                      padding: "18px",
                      marginBottom: "20px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: selectedPlan === "platinum" ? "#f0abfc" : "#93c5fd",
                        marginBottom: "8px",
                      }}
                    >
                      {planTitle.toUpperCase()} MEMBERSHIP REDEEM
                    </div>

                    <div
                      style={{
                        fontSize: "32px",
                        fontWeight: 800,
                        color: "#f8fafc",
                      }}
                    >
                      {planCoinCost.toLocaleString()} JB Coins
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        color: "#cbd5e1",
                        marginTop: "4px",
                      }}
                    >
                      Instant unlock after successful redeem
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(148,163,184,0.14)",
                      borderRadius: "18px",
                      background: "rgba(2, 6, 23, 0.35)",
                      padding: "18px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#f8fafc",
                        marginBottom: "12px",
                        textAlign: "center",
                      }}
                    >
                      Redeem Using JB Coins
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "14px",
                        marginBottom: "14px",
                      }}
                    >
                      <div
                        style={{
                          border: "1px solid rgba(148,163,184,0.14)",
                          borderRadius: "14px",
                          background: "rgba(15, 23, 42, 0.7)",
                          padding: "14px",
                        }}
                      >
                        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 800 }}>
                          CURRENT BALANCE
                        </div>
                        <div
                          style={{
                            fontSize: "24px",
                            fontWeight: 800,
                            color: "#f8fafc",
                            marginTop: "6px",
                          }}
                        >
                          {profileLoading ? "Loading..." : `${currentCoins.toLocaleString()} JB Coins`}
                        </div>
                      </div>

                      <div
                        style={{
                          border: "1px solid rgba(148,163,184,0.14)",
                          borderRadius: "14px",
                          background: "rgba(15, 23, 42, 0.7)",
                          padding: "14px",
                        }}
                      >
                        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 800 }}>
                          REQUIRED
                        </div>
                        <div
                          style={{
                            fontSize: "24px",
                            fontWeight: 800,
                            color: "#f8fafc",
                            marginTop: "6px",
                          }}
                        >
                          {planCoinCost.toLocaleString()} JB Coins
                        </div>
                      </div>

                      <div
                        style={{
                          border: "1px solid rgba(148,163,184,0.14)",
                          borderRadius: "14px",
                          background: "rgba(15, 23, 42, 0.7)",
                          padding: "14px",
                        }}
                      >
                        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 800 }}>
                          AFTER REDEEM
                        </div>
                        <div
                          style={{
                            fontSize: "24px",
                            fontWeight: 800,
                            color: "#f8fafc",
                            marginTop: "6px",
                          }}
                        >
                          {Math.max(0, currentCoins - planCoinCost).toLocaleString()} JB Coins
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        borderRadius: "14px",
                        background: hasEnoughCoins
                          ? "rgba(20, 83, 45, 0.34)"
                          : "rgba(127, 29, 29, 0.34)",
                        border: hasEnoughCoins
                          ? "1px solid rgba(74,222,128,0.26)"
                          : "1px solid rgba(248,113,113,0.24)",
                        padding: "14px",
                        fontSize: "14px",
                        fontWeight: 800,
                        color: hasEnoughCoins ? "#86efac" : "#fca5a5",
                        textAlign: "center",
                      }}
                    >
                      {profileLoading
                        ? "Checking your JB Coin balance..."
                        : hasEnoughCoins
                          ? `You have enough JB Coins to redeem ${planTitle}.`
                          : `You need ${(planCoinCost - currentCoins).toLocaleString()} more JB Coins to redeem ${planTitle}.`}
                    </div>
                  </div>

                  <div
                    style={{
                      marginBottom: "18px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {[
                      "Redeem is faster than manual payment review",
                      "Membership updates after successful redeem",
                      "Use your saved JB Coins anytime",
                    ].map((item) => (
                      <div
                        key={item}
                        style={{
                          border: "1px solid rgba(148,163,184,0.14)",
                          borderRadius: "14px",
                          background: "rgba(15, 23, 42, 0.58)",
                          padding: "14px",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#cbd5e1",
                          textAlign: "center",
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  <form
                    action="/api/upgrade/redeem-coins"
                    method="POST"
                    style={{
                      display: "grid",
                      gap: "14px",
                    }}
                  >
                    <input type="hidden" name="plan" value={selectedPlan} />
                    <input type="hidden" name="cost" value={String(planCoinCost)} />

                    <button
                      type="submit"
                      disabled={profileLoading || !profile || !hasEnoughCoins}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "15px 24px",
                        borderRadius: "14px",
                        background:
                          profileLoading || !profile || !hasEnoughCoins
                            ? "rgba(100, 116, 139, 0.5)"
                            : planGradient,
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 800,
                        fontSize: "15px",
                        cursor:
                          profileLoading || !profile || !hasEnoughCoins
                            ? "not-allowed"
                            : "pointer",
                        boxShadow:
                          selectedPlan === "platinum"
                            ? "0 10px 20px rgba(168, 85, 247, 0.24)"
                            : "0 10px 20px rgba(59, 130, 246, 0.24)",
                      }}
                    >
                      Redeem {planTitle} with {planCoinCost.toLocaleString()} JB Coins
                    </button>
                  </form>
                </div>
              ) : (
                <div
                  style={{
                    ...pageCardStyle,
                    padding: "22px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowPaymentBox((prev) => !prev)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      border: "1px solid rgba(148,163,184,0.18)",
                      borderRadius: "16px",
                      background: "rgba(2, 6, 23, 0.46)",
                      padding: "16px 18px",
                      cursor: "pointer",
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#f8fafc",
                    }}
                  >
                    <span>Payment Instructions for {planTitle}</span>
                    <span style={{ fontSize: "22px", lineHeight: 1 }}>▾</span>
                  </button>

                  <div
                    style={{
                      marginTop: "16px",
                      border:
                        selectedPlan === "platinum"
                          ? "1px solid rgba(232,121,249,0.24)"
                          : "1px solid rgba(96,165,250,0.24)",
                      background:
                        selectedPlan === "platinum"
                          ? "rgba(217,70,239,0.10)"
                          : "rgba(37,99,235,0.10)",
                      borderRadius: "18px",
                      padding: "18px",
                      marginBottom: "20px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: selectedPlan === "platinum" ? "#f0abfc" : "#93c5fd",
                        marginBottom: "8px",
                      }}
                    >
                      {planTitle.toUpperCase()} MEMBERSHIP
                    </div>

                    <div
                      style={{
                        fontSize: "32px",
                        fontWeight: 800,
                        color: "#f8fafc",
                      }}
                    >
                      {planPrice}
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        color: "#cbd5e1",
                        marginTop: "4px",
                      }}
                    >
                      per month
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(148,163,184,0.14)",
                      borderRadius: "18px",
                      background: "rgba(2, 6, 23, 0.35)",
                      padding: "18px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#f8fafc",
                        marginBottom: "10px",
                        textAlign: "center",
                      }}
                    >
                      Choose Payment Method
                    </div>

                    <p
                      style={{
                        margin: "0 0 14px",
                        fontSize: "14px",
                        color: "#cbd5e1",
                        lineHeight: 1.7,
                        textAlign: "center",
                      }}
                    >
                      Send <strong>{planPrice}</strong> first, then fill out the form
                      below and upload your receipt for manual review.
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        marginBottom: "18px",
                      }}
                    >
                      {[
                        { key: "gcash", label: "GCash" },
                        { key: "maya", label: "Maya" },
                        { key: "bank", label: "Bank / InstaPay" },
                      ].map((item) => {
                        const active = selectedPayment === item.key
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              setSelectedPayment(item.key as "gcash" | "maya" | "bank")
                            }
                            style={{
                              padding: "12px 16px",
                              borderRadius: "12px",
                              border: active
                                ? selectedPlan === "platinum"
                                  ? "2px solid #e879f9"
                                  : "2px solid #60a5fa"
                                : "1px solid rgba(148,163,184,0.18)",
                              background: active
                                ? selectedPlan === "platinum"
                                  ? "rgba(217,70,239,0.12)"
                                  : "rgba(37,99,235,0.12)"
                                : "rgba(15, 23, 42, 0.72)",
                              color: active
                                ? selectedPlan === "platinum"
                                  ? "#f0abfc"
                                  : "#93c5fd"
                                : "#cbd5e1",
                              fontWeight: 800,
                              fontSize: "14px",
                              cursor: "pointer",
                            }}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>

                    <div
                      style={{
                        border: "1px solid rgba(148,163,184,0.14)",
                        background: "rgba(15, 23, 42, 0.78)",
                        borderRadius: "16px",
                        padding: "16px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 800,
                          color: "#f8fafc",
                          marginBottom: "10px",
                        }}
                      >
                        {paymentDetails.label}
                      </div>

                      <img
                        src={paymentDetails.qr}
                        alt={`${paymentDetails.label} QR`}
                        style={{
                          width: "240px",
                          maxWidth: "100%",
                          display: "block",
                          margin: "0 auto 12px",
                          borderRadius: "12px",
                          border: "1px solid rgba(148,163,184,0.18)",
                          background: "#fff",
                        }}
                      />

                      <div style={{ fontSize: "14px", color: "#94a3b8" }}>
                        {paymentDetails.numberLabel}
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: 800,
                          color: "#f8fafc",
                          marginTop: "4px",
                        }}
                      >
                        {paymentDetails.number}
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#cbd5e1",
                          marginTop: "6px",
                        }}
                      >
                        {paymentDetails.name}
                      </div>

                      {paymentDetails.extra ? (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#94a3b8",
                            marginTop: "8px",
                          }}
                        >
                          {paymentDetails.extra}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        marginTop: "14px",
                        borderRadius: "14px",
                        background: "rgba(15, 23, 42, 0.76)",
                        border: "1px dashed rgba(148,163,184,0.20)",
                        padding: "14px",
                        fontSize: "13px",
                        color: "#cbd5e1",
                        lineHeight: 1.8,
                      }}
                    >
                      <div><strong>How it works:</strong></div>
                      <div>1. Send payment for the selected membership.</div>
                      <div>2. Choose the payment method you used.</div>
                      <div>3. Enter the payment name and reference number.</div>
                      <div>4. Upload your receipt securely.</div>
                      <div>5. Wait for admin approval and activation.</div>
                    </div>

                    <div
                      style={{
                        marginTop: "14px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {[
                        "Receipts are reviewed manually",
                        "Make sure details match your receipt",
                        "Activation happens after approval",
                      ].map((item) => (
                        <div
                          key={item}
                          style={{
                            border: "1px solid rgba(148,163,184,0.14)",
                            borderRadius: "14px",
                            background: "rgba(15, 23, 42, 0.58)",
                            padding: "14px",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#cbd5e1",
                            textAlign: "center",
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <p
                      style={{
                        marginTop: "10px",
                        fontSize: "12px",
                        color: "#94a3b8",
                        textAlign: "center",
                      }}
                    >
                      Make sure the payer name and reference number match the receipt you upload.
                    </p>
                  </div>

                  <form
                    action="/api/upgrade/request"
                    method="POST"
                    encType="multipart/form-data"
                    style={{
                      display: "grid",
                      gap: "14px",
                    }}
                  >
                    <input type="hidden" name="plan" value={selectedPlan} />

                    <input
                      type="text"
                      name="subject"
                      placeholder="Subject"
                      defaultValue={formDefaultSubject}
                      style={{
                        width: "100%",
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        fontSize: "15px",
                        outline: "none",
                        background: "rgba(15, 23, 42, 0.82)",
                        color: "#f8fafc",
                      }}
                    />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <input
                        type="text"
                        name="payment_name"
                        placeholder="Account name used for payment"
                        required
                        style={{
                          width: "100%",
                          border: "1px solid rgba(148,163,184,0.18)",
                          borderRadius: "14px",
                          padding: "14px 16px",
                          fontSize: "15px",
                          outline: "none",
                          background: "rgba(15, 23, 42, 0.82)",
                          color: "#f8fafc",
                        }}
                      />

                      <select
                        name="payment_method"
                        required
                        value={selectedPayment}
                        onChange={(e) =>
                          setSelectedPayment(e.target.value as "gcash" | "maya" | "bank")
                        }
                        style={{
                          width: "100%",
                          border: "1px solid rgba(148,163,184,0.18)",
                          borderRadius: "14px",
                          padding: "14px 16px",
                          fontSize: "15px",
                          outline: "none",
                          background: "rgba(15, 23, 42, 0.82)",
                          color: "#f8fafc",
                        }}
                      >
                        <option value="gcash">GCash</option>
                        <option value="maya">Maya</option>
                        <option value="bank">Bank / InstaPay</option>
                      </select>

                      <input
                        type="text"
                        name="payment_number"
                        placeholder="Mobile number or bank account used for payment"
                        style={{
                          width: "100%",
                          border: "1px solid rgba(148,163,184,0.18)",
                          borderRadius: "14px",
                          padding: "14px 16px",
                          fontSize: "15px",
                          outline: "none",
                          background: "rgba(15, 23, 42, 0.82)",
                          color: "#f8fafc",
                        }}
                      />

                      <input
                        type="text"
                        name="reference_number"
                        placeholder="Reference number"
                        required
                        style={{
                          width: "100%",
                          border: "1px solid rgba(148,163,184,0.18)",
                          borderRadius: "14px",
                          padding: "14px 16px",
                          fontSize: "15px",
                          outline: "none",
                          background: "rgba(15, 23, 42, 0.82)",
                          color: "#f8fafc",
                        }}
                      />
                    </div>

                    <textarea
                      name="message"
                      placeholder={`Write your reason for requesting ${planTitle.toLowerCase()} access...`}
                      required
                      rows={6}
                      style={{
                        width: "100%",
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        fontSize: "15px",
                        outline: "none",
                        resize: "vertical",
                        lineHeight: 1.6,
                        background: "rgba(15, 23, 42, 0.82)",
                        color: "#f8fafc",
                      }}
                    />

                    <div
                      style={{
                        border: "1px dashed rgba(148,163,184,0.22)",
                        borderRadius: "14px",
                        padding: "16px",
                        background: "rgba(15, 23, 42, 0.55)",
                      }}
                    >
                      <label
                        htmlFor="receipt"
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontSize: "14px",
                          fontWeight: 800,
                          color: "#e2e8f0",
                        }}
                      >
                        Upload receipt
                      </label>

                      <input
                        id="receipt"
                        type="file"
                        name="receipt"
                        accept="image/*,.pdf"
                        required
                        style={{
                          width: "100%",
                          fontSize: "14px",
                          color: "#cbd5e1",
                        }}
                      />

                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: "12px",
                          color: "#94a3b8",
                          lineHeight: 1.5,
                        }}
                      >
                        Accepted: JPG, PNG, WEBP, PDF
                      </p>
                    </div>

                    <button
                      type="submit"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "15px 24px",
                        borderRadius: "14px",
                        background: planGradient,
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 800,
                        fontSize: "15px",
                        cursor: "pointer",
                        boxShadow:
                          selectedPlan === "platinum"
                            ? "0 10px 20px rgba(168, 85, 247, 0.24)"
                            : "0 10px 20px rgba(59, 130, 246, 0.24)",
                      }}
                    >
                      Request {planTitle} Access
                    </button>
                  </form>

                  <p
                    style={{
                      margin: "12px 0 0",
                      fontSize: "13px",
                      color: "#94a3b8",
                      textAlign: "center",
                    }}
                  >
                    Upgrade requests are reviewed manually. Please wait for approval confirmation.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <footer
            style={{
              marginTop: "28px",
              padding: "18px 0 0",
              borderTop: "1px solid rgba(148, 163, 184, 0.12)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#94a3b8",
                lineHeight: 1.7,
              }}
            >
              Choose the membership level that matches the content you want to unlock.
            </p>

            <div
              style={{
                marginTop: "10px",
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/dashboard"
                style={{
                  color: "#93c5fd",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Back to Dashboard
              </Link>
              <Link
                href="/profile"
                style={{
                  color: "#c4b5fd",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                View Profile
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 22%), radial-gradient(circle at top right, rgba(217,70,239,0.14), transparent 24%), linear-gradient(180deg, #020617 0%, #0f172a 42%, #111827 100%)",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              background: "rgba(15, 23, 42, 0.82)",
              borderRadius: "18px",
              padding: "18px 22px",
              color: "#e2e8f0",
              fontWeight: 800,
              boxShadow: "0 8px 20px rgba(2, 6, 23, 0.36)",
            }}
          >
            Loading upgrade page...
          </div>
        </div>
      }
    >
      <UpgradePageContent />
    </Suspense>
  )
}