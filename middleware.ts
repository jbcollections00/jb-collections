import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

const ADMIN_LOGIN_PATH = "/admin/secure-admin-portal-7X9"
const ENTER_PATH = "/enter"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")

  const isEnterPage = pathname === ENTER_PATH

  if (!isStaticFile && !isEnterPage) {
    const hasEntered = request.cookies.get("site_entered")?.value

    if (!hasEntered) {
      return NextResponse.redirect(new URL(ENTER_PATH, request.url))
    }
  }

  const isAdminLoginPage = pathname === ADMIN_LOGIN_PATH
  const isProtectedAdminRoute =
    pathname.startsWith("/admin") && !isAdminLoginPage

  const protectedUserRoutes = [
    "/dashboard",
    "/profile",
    "/messages",
    "/upgrade",
    "/contact",
    "/categories",
  ]

  const isProtectedUserRoute = protectedUserRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

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
  } = await supabase.auth.getUser()

  if (isProtectedUserRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isProtectedAdminRoute) {
    if (!user) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url))
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}