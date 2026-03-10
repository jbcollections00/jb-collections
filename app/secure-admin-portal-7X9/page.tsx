"use client"

export default function AdminLoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, #dbeafe, #eff6ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "30px",
            marginBottom: "18px",
          }}
        >
          🔐
        </div>

        <div
          style={{
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "#2563eb",
          }}
        >
          ADMIN LOGIN
        </div>

        <h1
          style={{
            fontSize: "34px",
            margin: "10px 0 8px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Welcome back
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            fontSize: "15px",
            lineHeight: 1.7,
            color: "#64748b",
          }}
        >
          Sign in to access your admin workspace.
        </p>

        <form action="/secure-admin-portal-7X9/submit" method="POST" style={{ display: "grid", gap: "14px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              Email
            </label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your admin email"
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              Password
            </label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              marginTop: "8px",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "none",
              background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(37,99,235,0.22)",
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}