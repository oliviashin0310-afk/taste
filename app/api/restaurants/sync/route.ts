import { NextResponse } from "next/server";
import { fetchPublicRestaurantData } from "../../../../lib/data/public-restaurants";
import { listStoredRestaurants, upsertStoredRestaurants } from "../../../../lib/supabase/restaurants";

export const dynamic = "force-dynamic";

const supportedNeighborhoods = new Set(["연남동", "성산동", "동교동"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { neighborhood?: unknown };
    const neighborhood = typeof body.neighborhood === "string" ? body.neighborhood : "";
    if (!supportedNeighborhoods.has(neighborhood)) {
      return NextResponse.json({ error: "지원하지 않는 지역입니다." }, { status: 400 });
    }

    const { businesses } = await fetchPublicRestaurantData(neighborhood);
    await upsertStoredRestaurants(businesses);
    const storedBusinesses = await listStoredRestaurants(neighborhood);
    return NextResponse.json({ businesses: storedBusinesses, collectedCount: businesses.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "공공데이터 수집 및 Supabase 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
