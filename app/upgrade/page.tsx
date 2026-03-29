"use client"

import Link from "next/link"
import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import AdSlot from "@/app/components/AdSlot"
import SiteHeader from "@/app/components/SiteHeader"
import { IN_CONTENT_AD } from "@/app/lib/adCodes"

function normalizePlan(value?: string | null) {
  const plan = String(value || "").trim().toLowerCase()
  if (plan === "platinum") return "platinum"
  return "premium"
}

function UpgradePageContent() {
  const searchParams = useSearchParams()

  const success = searchParams?.get("success") ?? ""
  const error = searchParams?.get("error") ?? ""
  const initialPlan = normalizePlan(searchParams?.get("plan") ?? "")

  const [selectedPlan, setSelectedPlan] = useState<"premium" | "platinum">(initialPlan)
  const [showPaymentBox, setShowPaymentBox] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<"gcash" | "maya" | "bank">("gcash")

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
                      : error === "unexpected"
                        ? "Something went wrong. Please try again."
                        : null

  const planTitle = selectedPlan === "platinum" ? "Platinum" : "Premium"
  const planPrice = selectedPlan === "platinum" ? "₱299" : "₱149"
  const planGradient =
    selectedPlan === "platinum"
      ? "linear-gradient(90deg, #c026d3, #7c3aed)"
      : "linear-gradient(90deg, #0ea5e9, #4f46e5)"
  const formDefaultSubject =
    selectedPlan === "platinum"
      ? "Platinum upgrade request"
      : "Premium upgrade request"
  const successText =
    selectedPlan === "platinum"
      ? "Your platinum upgrade request was submitted successfully."
      : "Your premium upgrade request was submitted successfully."

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

  function choosePlan(plan: "premium" | "platinum") {
    setSelectedPlan(plan)
    setShowPaymentBox(true)

    setTimeout(() => {
      const el = document.getElementById("payment-section")
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 100)
  }

  return (
    <>
      <SiteHeader />

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
          padding: "100px 14px 14px",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: "1800px", margin: "0 auto" }}>
          <div
            style={{
              marginBottom: "22px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "980px",
                borderRadius: "24px",
                background: "#ffffff",
                border: "1px solid #dbe4f0",
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
                overflow: "hidden",
                padding: "16px",
              }}
            >
              <AdSlot code={IN_CONTENT_AD} />
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "inline-block",
                marginBottom: "14px",
                padding: "7px 14px",
                borderRadius: "999px",
                background: selectedPlan === "platinum" ? "#fae8ff" : "#eef2ff",
                color: selectedPlan === "platinum" ? "#a21caf" : "#4338ca",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.3px",
              }}
            >
              MEMBERSHIP UPGRADE
            </div>

            <h2
              style={{
                margin: "0 0 14px",
                fontSize: "36px",
                lineHeight: 1.15,
                color: "#0f172a",
                fontWeight: 800,
              }}
            >
              Unlock More Downloads
            </h2>

            <p
              style={{
                margin: "0 auto",
                maxWidth: "720px",
                fontSize: "17px",
                lineHeight: 1.75,
                color: "#64748b",
              }}
            >
              Choose the plan that fits your access level. Upgrade to unlock premium
              files, faster downloads, and platinum-exclusive releases inside JB Collections.
            </p>
          </div>

          {success === "1" && (
            <div
              style={{
                marginBottom: "18px",
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#15803d",
                borderRadius: "16px",
                padding: "14px 16px",
                fontSize: "14px",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {successText}
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                marginBottom: "18px",
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
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
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "18px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "22px",
                background: "#ffffff",
                padding: "22px",
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: "10px",
                }}
              >
                FREE
              </div>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: "4px",
                }}
              >
                ₱0
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#64748b",
                  marginBottom: "18px",
                }}
              >
                basic access
              </div>

              <div style={{ display: "grid", gap: "10px", fontSize: "14px", color: "#475569" }}>
                <div>✔ Access free files</div>
                <div>✔ Can browse all categories</div>
                <div>✖ Sponsored step on free downloads</div>
                <div>✖ No premium files</div>
                <div>✖ No platinum files</div>
              </div>
            </div>

            <div
              style={{
                border:
                  selectedPlan === "premium" ? "2px solid #2563eb" : "1px solid #bfdbfe",
                borderRadius: "22px",
                background: "#ffffff",
                padding: "22px",
                boxShadow: "0 12px 28px rgba(37, 99, 235, 0.10)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#2563eb",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                MOST POPULAR
              </div>

              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#2563eb",
                  marginBottom: "10px",
                }}
              >
                PREMIUM
              </div>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: "4px",
                }}
              >
                ₱149
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#64748b",
                  marginBottom: "18px",
                }}
              >
                per month
              </div>

              <div style={{ display: "grid", gap: "10px", fontSize: "14px", color: "#475569" }}>
                <div>✔ Access premium files</div>
                <div>✔ Direct downloads</div>
                <div>✔ No sponsored step on premium/free files</div>
                <div>✔ Faster experience</div>
                <div>✖ No platinum-exclusive files</div>
              </div>

              <div style={{ marginTop: "18px" }}>
                <button
                  type="button"
                  onClick={() => choosePlan("premium")}
                  style={{
                    display: "inline-flex",
                    width: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "12px 18px",
                    borderRadius: "14px",
                    background: "linear-gradient(90deg, #0ea5e9, #4f46e5)",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Choose Premium
                </button>
              </div>
            </div>

            <div
              style={{
                border:
                  selectedPlan === "platinum" ? "2px solid #a21caf" : "1px solid #e9d5ff",
                borderRadius: "22px",
                background: "#ffffff",
                padding: "22px",
                boxShadow: "0 12px 28px rgba(124, 58, 237, 0.10)",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#a21caf",
                  marginBottom: "10px",
                }}
              >
                PLATINUM
              </div>
              <div
                style={{
                  fontSize: "32px",
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: "4px",
                }}
              >
                ₱299
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#64748b",
                  marginBottom: "18px",
                }}
              >
                per month
              </div>

              <div style={{ display: "grid", gap: "10px", fontSize: "14px", color: "#475569" }}>
                <div>✔ Everything in Premium</div>
                <div>✔ Access platinum-exclusive files</div>
                <div>✔ Highest access level</div>
                <div>✔ Best for exclusive releases</div>
                <div>✔ Premium + Platinum content</div>
              </div>

              <div style={{ marginTop: "18px" }}>
                <button
                  type="button"
                  onClick={() => choosePlan("platinum")}
                  style={{
                    display: "inline-flex",
                    width: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "12px 18px",
                    borderRadius: "14px",
                    background: "linear-gradient(90deg, #c026d3, #7c3aed)",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Choose Platinum
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: "24px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "980px",
                borderRadius: "24px",
                background: "#ffffff",
                border: "1px solid #dbe4f0",
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
                overflow: "hidden",
                padding: "16px",
              }}
            >
              <AdSlot code={IN_CONTENT_AD} />
            </div>
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
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "22px",
                  background: "#ffffff",
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
                    border: "1px solid #cbd5e1",
                    borderRadius: "16px",
                    background: "#f8fafc",
                    padding: "16px 18px",
                    cursor: "pointer",
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#0f172a",
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
                        ? "1px solid #f5d0fe"
                        : "1px solid #bfdbfe",
                    background:
                      selectedPlan === "platinum" ? "#fdf4ff" : "#eff6ff",
                    borderRadius: "18px",
                    padding: "18px",
                    marginBottom: "20px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: selectedPlan === "platinum" ? "#a21caf" : "#1d4ed8",
                      marginBottom: "8px",
                    }}
                  >
                    {planTitle.toUpperCase()} MEMBERSHIP
                  </div>

                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    {planPrice}
                  </div>

                  <div
                    style={{
                      fontSize: "14px",
                      color: "#64748b",
                      marginTop: "4px",
                    }}
                  >
                    per month
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "18px",
                    background: "#f8fafc",
                    padding: "18px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#0f172a",
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
                      color: "#475569",
                      lineHeight: 1.7,
                      textAlign: "center",
                    }}
                  >
                    Send <strong>{planPrice}</strong> first, then fill out the form below and upload your receipt.
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
                            border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
                            background: active ? "#eff6ff" : "#ffffff",
                            color: active ? "#1d4ed8" : "#334155",
                            fontWeight: 700,
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
                      border: "1px solid #dbeafe",
                      background: "#ffffff",
                      borderRadius: "16px",
                      padding: "16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "#0f172a",
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
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                      }}
                    />

                    <div style={{ fontSize: "14px", color: "#64748b" }}>
                      {paymentDetails.numberLabel}
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                      {paymentDetails.number}
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>
                      {paymentDetails.name}
                    </div>

                    {paymentDetails.extra ? (
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                        {paymentDetails.extra}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      marginTop: "14px",
                      borderRadius: "14px",
                      background: "#ffffff",
                      border: "1px dashed #cbd5e1",
                      padding: "14px",
                      fontSize: "13px",
                      color: "#475569",
                      lineHeight: 1.7,
                    }}
                  >
                    <div><strong>How it works:</strong></div>
                    <div>1. Send payment for the selected membership.</div>
                    <div>2. Choose the payment method you used.</div>
                    <div>3. Enter the payment name and reference number.</div>
                    <div>4. Upload your receipt.</div>
                    <div>5. Wait for admin approval.</div>
                  </div>

                  <p
                    style={{
                      marginTop: "10px",
                      fontSize: "12px",
                      color: "#64748b",
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
                      border: "1px solid #cbd5e1",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      fontSize: "15px",
                      outline: "none",
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
                        border: "1px solid #cbd5e1",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        fontSize: "15px",
                        outline: "none",
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
                        border: "1px solid #cbd5e1",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        fontSize: "15px",
                        outline: "none",
                        background: "#fff",
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
                        border: "1px solid #cbd5e1",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        fontSize: "15px",
                        outline: "none",
                      }}
                    />

                    <input
                      type="text"
                      name="reference_number"
                      placeholder="Reference number"
                      required
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        fontSize: "15px",
                        outline: "none",
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
                      border: "1px solid #cbd5e1",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      fontSize: "15px",
                      outline: "none",
                      resize: "vertical",
                      lineHeight: 1.6,
                    }}
                  />

                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: "14px",
                      padding: "16px",
                      background: "#f8fafc",
                    }}
                  >
                    <label
                      htmlFor="receipt"
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#334155",
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
                        color: "#475569",
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
                      fontWeight: 700,
                      fontSize: "15px",
                      cursor: "pointer",
                      boxShadow:
                        selectedPlan === "platinum"
                          ? "0 10px 20px rgba(124, 58, 237, 0.22)"
                          : "0 10px 20px rgba(59, 130, 246, 0.22)",
                    }}
                  >
                    Request {planTitle} Access
                  </button>
                </form>

                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: "13px",
                    color: "#64748b",
                    textAlign: "center",
                  }}
                >
                  Upgrade requests are reviewed manually. Please wait for approval confirmation.
                </p>
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: "24px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "980px",
                borderRadius: "24px",
                background: "#ffffff",
                border: "1px solid #dbe4f0",
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
                overflow: "hidden",
                padding: "16px",
              }}
            >
              <AdSlot code={IN_CONTENT_AD} />
            </div>
          </div>

          <footer
            style={{
              marginTop: "28px",
              padding: "18px 0 0",
              borderTop: "1px solid #dbe4f0",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              Choose the membership level that matches the content you want to unlock.
            </p>
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
            background: "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <div
            style={{
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              borderRadius: "18px",
              padding: "18px 22px",
              color: "#334155",
              fontWeight: 700,
              boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
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