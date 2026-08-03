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

    // Extracts user_id (or ext_user_id fallback), amount_local, status, and trans_id
    const userId = searchParams.get('user_id') || searchParams.get('ext_user_id');
    const amountLocal = searchParams.get('amount_local');
    const status = searchParams.get('status');
    const transId = searchParams.get('trans_id');

    // 1. Validate required parameters
    if (!userId || !amountLocal) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    const coinsToCredit = parseInt(amountLocal, 10);

    // 2. Process reward only when status is '1' (Completed Survey) and coins > 0
    if (status === '1' && coinsToCredit > 0) {
      const { error } = await supabase.rpc('credit_user_coins', {
        user_id_input: userId,
        amount_input: coinsToCredit,
        source_type_input: 'cpx_survey',
        description_input: `Completed CPX Survey #${transId || ''} (+${coinsToCredit} JB Coins)`,
      });

      if (error) {
        console.error('Supabase RPC Error:', error);
        return new NextResponse('Database Error', { status: 500 });
      }
    }

    // CPX Research requires an exact text response of "OK" with HTTP status 200
    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('CPX Webhook Error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}