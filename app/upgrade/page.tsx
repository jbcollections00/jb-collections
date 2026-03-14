import Link from "next/link"

export default function UpgradePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
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
          maxWidth: "760px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "28px",
          padding: "40px 28px",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "92px",
            height: "92px",
            margin: "0 auto 20px",
            borderRadius: "999px",
            background: "linear-gradient(135deg, #2563eb, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "38px",
            color: "#fff",
            boxShadow: "0 12px 25px rgba(79, 70, 229, 0.25)",
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
            background: "#eef2ff",
            color: "#4338ca",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.3px",
          }}
        >
          PREMIUM ACCESS REQUIRED
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
          Unlock Premium Downloads
        </h1>

        <p
          style={{
            margin: "0 auto 28px",
            maxWidth: "580px",
            fontSize: "17px",
            lineHeight: 1.75,
            color: "#64748b",
          }}
        >
          This file is available only for premium members. Upgrade your account
          to access premium downloads, exclusive archive sets, and member-only
          content inside JB Collections.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            textAlign: "left",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "18px",
              padding: "16px",
              background: "#f8fbff",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "8px" }}>📁</div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "6px",
              }}
            >
              Premium Files
            </div>
            <div style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Access exclusive downloadable collections not available to free users.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "18px",
              padding: "16px",
              background: "#f8fbff",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "8px" }}>⭐</div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "6px",
              }}
            >
              Exclusive Content
            </div>
            <div style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Enjoy members-only archive releases and premium-only file access.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "18px",
              padding: "16px",
              background: "#f8fbff",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "8px" }}>⚡</div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "6px",
              }}
            >
              Instant Access
            </div>
            <div style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Once approved, you can immediately start downloading premium files.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <Link
            href="/dashboard/upgrades"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 24px",
              borderRadius: "14px",
              background: "linear-gradient(90deg, #0ea5e9, #4f46e5)",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "15px",
              boxShadow: "0 10px 20px rgba(59, 130, 246, 0.22)",
            }}
          >
            Upgrade Now
          </Link>

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
          }}
        >
          Premium membership is required before this protected download can start.
        </p>
      </div>
    </div>
  )
}