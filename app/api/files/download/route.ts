// deploy-refresh-1
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: "NEW DOWNLOAD ROUTE LIVE",
    url: req.url,
  })
}