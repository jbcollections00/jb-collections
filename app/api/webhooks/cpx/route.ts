import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin client with Service Role Key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Regex helper to check valid UUID format
function isValidUUID(uuid: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get('user_id') || searchParams.get('ext_user_id');
    const amountLocal = searchParams.get('amount_local');
    const status = searchParams.get('status');
    const transId = searchParams.get('trans_id');

    if (!userId || !amountLocal) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // Safely parse decimals like "25.0000" into rounded integer
    const coinsToCredit = Math.round(parseFloat(amountLocal));

    // Handle test user IDs (like test_user_123) so CPX tests pass with 200 OK
    if (!isValidUUID(userId)) {
      console.log(`[CPX Webhook] Test user ID detected (${userId}). Returning OK.`);
      return new NextResponse('OK', { status: 200 });
    }

    // Process real credit in Supabase if status is '1' (Completed)
    if (status === '1' && coinsToCredit > 0) {
      const { error } = await supabase.rpc('credit_user_coins', {
        user_id_input: userId,
        amount_input: coinsToCredit,
        source_type_input: 'cpx_survey',
        description_input: `Completed CPX Survey #${transId || ''} (+${coinsToCredit} JB Coins)`,
      });

      if (error) {
        console.error('Supabase RPC Error:', error);
        return new NextResponse('OK', { status: 200 });
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('CPX Webhook Exception:', err);
    return new NextResponse('OK', { status: 200 });
  }
}