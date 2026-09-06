import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const cpagripUrl = `https://www.cpagrip.com/common/offer_feed_json.php?user_id=2546994&pubkey=24b327f74d8b0c75f0b6b99c5e5560bd&offer_type=Email/Zip%20Submit&tracking_id=${userId}`;

  try {
    const res = await fetch(cpagripUrl, { cache: 'no-store' });
    const data = await res.json();

    // MGA ID NG MALILINIS NA MOBILE OFFERS
    // Tinanggal na ang Desktop ID (74257) para iwas sa junk redirect ads sa PC
    const SELECTED_IDS = [
      '74096', '74097',  // PS5 (Android & iOS)
      '72104', '72105',  // Smart Watch (Android & iOS)
      '74258', '74259'   // Spin Wheel (Android & iOS lang)
    ];

    const filteredOffers = (data.offers || []).filter((offer: any) =>
      SELECTED_IDS.includes(String(offer.offer_id))
    );

    return NextResponse.json({ ...data, offers: filteredOffers });
  } catch (error) {
    console.error("Error fetching CPAGrip offers:", error);
    return NextResponse.json({ error: 'Failed to fetch offers from CPAGrip' }, { status: 500 });
  }
}