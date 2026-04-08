import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const ADMIN_LOGIN_PATH = "/secure-admin-portal-7X9"
const ENTER_PATH = "/enter"
const ENTER_COOKIE = "site_entered"

const PROTECTED_USER_ROUTES = [
  "/dashboard",
  "/profile",
  "/messages",
  "/upgrade",
  "/contact",
  "/categories",
  "/download",
]

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // ✅ Skip static + API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const isEnterPage = pathname === ENTER_PATH
  const isLoginPage = pathname === "/login"
  const isAdminLoginPage = pathname === ADMIN_LOGIN_PATH
  const isAuthPage = pathname.startsWith("/auth")

  const isProtectedAdminRoute = pathname.startsWith("/admin")
  const isProtectedUserRoute = PROTECTED_USER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  // ✅ ENTER GATE
  if (!isEnterPage && !isLoginPage && !isAdminLoginPage && !isAuthPage) {
    const hasEntered = request.cookies.get(ENTER_COOKIE)?.value === "true"

    if (!hasEntered) {
      const enterUrl = new URL(ENTER_PATH, request.url)
      enterUrl.searchParams.set("next", `${pathname}${search}`)
      return NextResponse.redirect(enterUrl)
    }
  }

  // ❗ TEMP: Skip auth check to prevent crash
  if (isProtectedUserRoute) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (isProtectedAdminRoute) {
    const adminLoginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
    adminLoginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(adminLoginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}