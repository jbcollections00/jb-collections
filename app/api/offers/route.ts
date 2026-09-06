import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const cpagripUrl = `https://www.cpagrip.com/common/offer_feed_json.php?user_id=2546994&key=2d439789f1d8d23756b853675768e34c&offer_type=Email/Zip%20Submit&country=PH&tracking_id=${userId}`;

  try {
    const res = await fetch(cpagripUrl, { cache: 'no-store' });
    
    // Kukunin muna natin bilang text para hindi mag-crash kapag HTML ang ibinigay
    const rawText = await res.text();

    try {
      // Susubukang i-convert ang text sa JSON
      const data = JSON.parse(rawText);
      
      const rawOffers = Array.isArray(data?.offers) ? data.offers : [];
      const SELECTED_IDS = ['74096', '74097', '72104', '72105', '74258', '74259'];

      let finalOffers = rawOffers.filter((offer: any) =>
        SELECTED_IDS.includes(String(offer.offer_id))
      );

      if (finalOffers.length === 0 && rawOffers.length > 0) {
        finalOffers = rawOffers.slice(0, 3);
      }

      return NextResponse.json({ offers: finalOffers });

    } catch (parseError) {
      // Kung hindi JSON, ipi-print sa terminal ang unang 200 letters ng error page
      console.error("HINDI JSON ANG IBINALIK NG CPAGRIP. Nakasulat ay:", rawText.substring(0, 200));
      return NextResponse.json({ offers: [] });
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    return NextResponse.json({ offers: [] });
  }
}