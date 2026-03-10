import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #eef2fb 0%, #e8eefc 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          background: "#c3cff8",
          borderRadius: "30px",
          boxShadow: "0 24px 55px rgba(0,0,0,0.08)",
          padding: "42px 38px",
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
              opacity: 0.9,
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
            Welcome Back
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
            Sign in to continue to{" "}
            <span style={{ fontWeight: 700, color: "#0d1635" }}>
              JB Collections
            </span>
          </p>
        </div>

        <form method="post" action="/api/auth/login" style={{ marginTop: "24px" }}>
          <div style={{ marginBottom: "18px" }}>
            <label htmlFor="email" style={labelStyle}>
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "24px",
            }}
          >
            <Link
              href="/forgot-password"
              style={{
                color: "#1557ff",
                fontSize: "15px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Forgot Password?
            </Link>
          </div>

          <button type="submit" style={submitButton}>
            Login
          </button>

          <div style={dividerWrap}>
            <div style={dividerLine} />
            <span style={{ color: "#64748b", fontSize: "15px" }}>or</span>
            <div style={dividerLine} />
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
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              style={{
                color: "#1557ff",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Create one
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "10px",
  fontSize: "15px",
  color: "#334155",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "54px",
  borderRadius: "14px",
  border: "1px solid #dbe4ff",
  outline: "none",
  padding: "0 16px",
  fontSize: "16px",
  background: "#ffffff",
  color: "#111827",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.03)",
};

const submitButton: React.CSSProperties = {
  width: "100%",
  height: "52px",
  border: "none",
  borderRadius: "14px",
  background: "#1557ff",
  color: "#fff",
  fontSize: "18px",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(21,87,255,0.24)",
};

const dividerWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  margin: "26px 0",
};

const dividerLine: React.CSSProperties = {
  flex: 1,
  height: "1px",
  background: "#d6def8",
};

const googleButton: React.CSSProperties = {
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
};