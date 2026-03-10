import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  const isAdminLoginPage = pathname === "/admin/login"
  const isProtectedAdminRoute = pathname.startsWith("/admin") && !isAdminLoginPage

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
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
      return NextResponse.redirect(new URL("/secure-admin-portal-7X9", request.url))
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/secure-admin-portal-7X9", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/messages",
    "/messages/:path*",
    "/upgrade",
    "/upgrade/:path*",
    "/contact",
    "/contact/:path*",
    "/categories",
    "/categories/:path*",
  ],
}