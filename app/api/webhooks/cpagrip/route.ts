import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client with Service Role Key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract query parameters sent by CPAGrip Postback
    const password = searchParams.get('password');
    const payoutRaw = searchParams.get('payout') || '0';
    const payout = parseFloat(payoutRaw);
    const trackingId = searchParams.get('tracking_id') || searchParams.get('subid');

    // 1. Verify Secret Password
    const secretKey = process.env.CPAGRIP_WEBHOOK_SECRET || 'jb_cpagrip_secret_123';
    if (password !== secretKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid password' },
        { status: 401 }
      );
    }

    // 2. Validate tracking_id (User ID)
    if (!trackingId) {
      return NextResponse.json(
        { success: false, error: 'Missing parameter: tracking_id' },
        { status: 400 }
      );
    }

    // 3. Set fixed reward to 500 JB Coins
    const coinsToCredit = 500;

    // 4. Call Supabase RPC function (credit_user_coins)
    const { error } = await supabase.rpc('credit_user_coins', {
      user_id_input: trackingId,
      amount_input: coinsToCredit,
      source_type_input: 'cpagrip_offer',
      description_input: `Completed CPAGrip Offer (+$${payout.toFixed(2)})`,
    });

    if (error) {
      console.error('Supabase RPC Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 5. Return success JSON payload
    return NextResponse.json({
      success: true,
      message: 'Coins credited successfully',
      tracking_id: trackingId,
      coinsCredited: coinsToCredit,
      payout: payout,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Webhook Error:', err);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}