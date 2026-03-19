import Link from "next/link"

type UpgradePageProps = {
  searchParams?: {
    success?: string
    error?: string
    plan?: string
  }
}

function normalizePlan(value?: string) {
  const plan = String(value || "").trim().toLowerCase()
  if (plan === "platinum") return "platinum"
  return "premium"
}

export default function UpgradePage({ searchParams }: UpgradePageProps) {
  const params = searchParams || {}
  const success = params.success
  const error = params.error
  const selectedPlan = normalizePlan(params.plan)

  const errorMessage =
    error === "missing-message"
      ? "Please enter your upgrade reason."
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
        padding: "24px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: "1180px", margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "92px",
              height: "92px",
              margin: "0 auto 20px",
              borderRadius: "999px",
              background:
                selectedPlan === "platinum"
                  ? "linear-gradient(135deg, #c026d3, #7c3aed)"
                  : "linear-gradient(135deg, #2563eb, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "38px",
              color: "#fff",
              boxShadow:
                selectedPlan === "platinum"
                  ? "0 12px 25px rgba(124, 58, 237, 0.25)"
                  : "0 12px 25px rgba(79, 70, 229, 0.25)",
            }}
          >
            👑
          </div>

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

          <h1
            style={{
              margin: "0 0 14px",
              fontSize: "36px",
              lineHeight: 1.15,
              color: "#0f172a",
              fontWeight: 800,
            }}
          >
            Unlock More Downloads
          </h1>

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
              <Link
                href="/upgrade?plan=premium"
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
                }}
              >
                Choose Premium
              </Link>
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
              <Link
                href="/upgrade?plan=platinum"
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
                }}
              >
                Choose Platinum
              </Link>
            </div>
          </div>
        </div>

        <div
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
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "24px",
                color: "#0f172a",
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              Request {planTitle} Access
            </h2>

            <div
              style={{
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
                  Upload receipt (optional)
                </label>

                <input
                  id="receipt"
                  type="file"
                  name="receipt"
                  accept="image/*,.pdf"
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

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: "24px",
            marginBottom: "18px",
          }}
        >
          <Link
            href="/categories"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 24px",
              borderRadius: "14px",
              background: "#ffffff",
              color: "#0f172a",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "15px",
              border: "1px solid #cbd5e1",
            }}
          >
            Back to Categories
          </Link>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#94a3b8",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          Choose the membership level that matches the content you want to unlock.
        </p>
      </div>
    </div>
  )
}