import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
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
      <section
        style={{
          width: "100%",
          maxWidth: "1240px",
          background: "#c3cff8",
          borderRadius: "34px",
          boxShadow: "0 24px 55px rgba(0,0,0,0.08)",
          padding: "72px 68px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <div>
            

            <h1
              style={{
                margin: 0,
                fontSize: "58px",
                lineHeight: "1.12",
                fontWeight: 800,
                color: "#0d1635",
                letterSpacing: "-1px",
              }}
            >
              Elevate your Experience with <span style={{ color: "#1557ff" }}>JB Collections</span>
            </h1>

            <p
              style={{
                marginTop: "20px",
                maxWidth: "560px",
                fontSize: "18px",
                lineHeight: "1.8",
                color: "#334155",
              }}
            >
              Discover expansive resources, premium downloads, and exclusive
              digital collections in one simple and user-friendly platform.
            </p>

            <div
              style={{
                display: "flex",
                gap: "16px",
                marginTop: "30px",
                flexWrap: "wrap",
              }}
            >
              <Link href="/login" style={primaryButton}>
                Login
              </Link>
              <Link href="/signup" style={secondaryButton}>
                Create Account
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Image
              src="/jb-logo.png"
              alt="JB Collections"
              width={540}
              height={540}
              priority
              style={{
                width: "100%",
                maxWidth: "460px",
                height: "auto",
                opacity: 0.22,
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

const primaryButton: React.CSSProperties = {
  textDecoration: "none",
  background: "#1557ff",
  color: "#ffffff",
  padding: "15px 30px",
  minWidth: "180px",
  textAlign: "center",
  borderRadius: "14px",
  fontWeight: 700,
  fontSize: "17px",
  boxShadow: "0 10px 24px rgba(21,87,255,0.24)",
};

const secondaryButton: React.CSSProperties = {
  textDecoration: "none",
  background: "#ffffff",
  color: "#1557ff",
  padding: "15px 30px",
  minWidth: "180px",
  textAlign: "center",
  borderRadius: "14px",
  fontWeight: 700,
  fontSize: "17px",
  border: "2px solid #1557ff",
};