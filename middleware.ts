import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

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
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const search = request.nextUrl.search

  const response = NextResponse.next()

  const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.includes(".")

  const isEnterPage = pathname === ENTER_PATH
  const isAdminLoginPage = pathname === ADMIN_LOGIN_PATH
  const isProtectedAdminRoute = pathname.startsWith("/admin")
  const isProtectedUserRoute = PROTECTED_USER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (isStaticFile) {
    return response
  }

  if (!isEnterPage && !isAdminLoginPage) {
    const hasEntered = request.cookies.get(ENTER_COOKIE)?.value === "true"

    if (!hasEntered) {
      const enterUrl = new URL(ENTER_PATH, request.url)
      enterUrl.searchParams.set("next", `${pathname}${search}`)
      return NextResponse.redirect(enterUrl)
    }
  }

  if (!isProtectedAdminRoute && !isProtectedUserRoute) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, any>) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: Record<string, any>) {
          response.cookies.set({
            name,
            value: "",
            ...options,
            maxAge: 0,
          })
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.error("Middleware auth error:", userError)
  }

  if (isProtectedUserRoute && !user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (isProtectedAdminRoute) {
    if (!user) {
      const adminLoginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
      adminLoginUrl.searchParams.set("next", `${pathname}${search}`)
      return NextResponse.redirect(adminLoginUrl)
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Middleware admin profile error:", profileError)

      const adminLoginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
      adminLoginUrl.searchParams.set("error", "failed")
      return NextResponse.redirect(adminLoginUrl)
    }

    if (!profile || profile.role !== "admin") {
      const adminLoginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
      adminLoginUrl.searchParams.set("error", "not-admin")
      return NextResponse.redirect(adminLoginUrl)
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}