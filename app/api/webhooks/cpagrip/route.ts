import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handlePostback(password: string | null, trackingId: string | null, payoutRaw: string | null) {
  const secretKey = process.env.CPAGRIP_WEBHOOK_SECRET || 'jb_cpagrip_secret_123';
  if (password !== secretKey) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid password' },
      { status: 401 }
    );
  }

  if (!trackingId) {
    return NextResponse.json(
      { success: false, error: 'Missing parameter: tracking_id' },
      { status: 400 }
    );
  }

  const payout = parseFloat(payoutRaw || '0');
  const coinsToCredit = 500;

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

  return NextResponse.json({
    success: true,
    message: 'Coins credited successfully',
    tracking_id: trackingId,
    coinsCredited: coinsToCredit,
    payout: payout,
  });
}

// Support POST Request
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const password = formData.get('password')?.toString() || null;
    const trackingId = formData.get('tracking_id')?.toString() || formData.get('subid')?.toString() || null;
    const payout = formData.get('payout')?.toString() || '0';

    return await handlePostback(password, trackingId, payout);
  } catch {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// Support GET Request (para sa URL Query testing)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const trackingId = searchParams.get('tracking_id') || searchParams.get('subid');
    const payout = searchParams.get('payout') || '0';

    return await handlePostback(password, trackingId, payout);
  } catch {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}