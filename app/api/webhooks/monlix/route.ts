import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client with Service Role Key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to validate standard Supabase UUID format
function isValidUUID(uuid: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Monlix postback parameters
    const userId = searchParams.get('userId') || searchParams.get('user_id') || searchParams.get('custom');
    const rewardValue = searchParams.get('rewardValue') || searchParams.get('amount');
    const transactionId = searchParams.get('transactionId') || searchParams.get('id');
    const status = searchParams.get('status'); // '1' = completed, '2' = revoked

    // 1. Validate mandatory fields
    if (!userId || !rewardValue) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Safely parse decimals (e.g. 10.50 -> 11)
    const coinsToCredit = Math.round(parseFloat(rewardValue));

    // 2. Pass dashboard test ping (e.g. test_user or invalid UUIDs)
    if (!isValidUUID(userId)) {
      console.log(`[Monlix Webhook] Test user ID detected (${userId}). Returning 200 OK.`);
      return NextResponse.json({ success: true, message: 'Test postback OK' }, { status: 200 });
    }

    // 3. Process coin credit in Supabase if status is '1' (or not explicitly revoked)
    if ((!status || status === '1') && coinsToCredit > 0) {
      const { error } = await supabase.rpc('credit_user_coins', {
        user_id_input: userId,
        amount_input: coinsToCredit,
        source_type_input: 'monlix_offer',
        description_input: `Completed Monlix Offer #${transactionId || ''} (+${coinsToCredit} JB Coins)`,
      });

      if (error) {
        console.error('Supabase RPC Error:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Monlix Webhook Exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}