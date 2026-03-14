import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    status: "DOWNLOAD ROUTE UPDATED",
    message: "This proves the correct route is deployed."
  })
}