import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    transactions: [
      {
        id: "TXN-20260411-9182",
        label: "JB Coin Booster",
        amount: 499,
        coins: 1300,
        bonus: 200,
        base: 1100,
        method: "maya",
        payerName: "Carlos M.",
        referenceNumber: "MAYA-88341027",
        notes: "",
        status: "credited",
        createdAt: "2026-04-11T08:22:00.000Z",
        receiptName: "maya-receipt-apr11.jpg",
      },
    ],
  })
}