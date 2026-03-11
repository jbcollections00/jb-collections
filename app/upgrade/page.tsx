import Link from "next/link"

export default function UpgradePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "24px",
          padding: "36px 28px",
          boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "82px",
            height: "82px",
            margin: "0 auto 18px",
            borderRadius: "999px",
            background: "linear-gradient(135deg, #2563eb, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "34px",
            color: "#fff",
          }}
        >
          👑
        </div>

        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "34px",
            lineHeight: 1.15,
            color: "#0f172a",
            fontWeight: 800,
          }}
        >
          Upgrade to Premium
        </h1>

        <p
          style={{
            margin: "0 auto 24px",
            maxWidth: "520px",
            fontSize: "17px",
            lineHeight: 1.7,
            color: "#64748b",
          }}
        >
          This file is available for premium members only. Upgrade your account to unlock premium downloads and exclusive content.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          <Link
            href="/dashboard/upgrades"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 22px",
              borderRadius: "14px",
              background: "linear-gradient(90deg, #0ea5e9, #4f46e5)",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Go to Upgrade Page
          </Link>

          <Link
            href="/categories"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 22px",
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
          }}
        >
          Premium access is required before this download can start.
        </p>
      </div>
    </div>
  )
}