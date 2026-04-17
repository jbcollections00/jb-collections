import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const ADMIN_LOGIN_PATH = "/secure-admin-portal-7X9"
const LOGIN_PATH = "/login"

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const isProtectedAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/")

  const isProtectedUserRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/upgrade" ||
    pathname.startsWith("/upgrade/") ||
    pathname === "/contact" ||
    pathname.startsWith("/contact/") ||
    pathname === "/categories" ||
    pathname.startsWith("/categories/")

  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
    )

  if (isProtectedAdminRoute && !hasAuthCookie) {
    const adminLoginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
    adminLoginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(adminLoginUrl)
  }

  if (isProtectedUserRoute && !hasAuthCookie) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/messages/:path*",
    "/upgrade/:path*",
    "/contact/:path*",
    "/categories/:path*",
    "/admin/:path*",
  ],
}