import { NextResponse } from "next/server";
import { searchNearbyStoredRestaurants } from "../../../../lib/supabase/restaurants";
import { matchesRestaurantCategory } from "../../../data/categoryFilters";

export const dynamic = "force-dynamic";

type NearbySearchRequest = {
  latitude?: unknown;
  longitude?: unknown;
  radiusMeters?: unknown;
  query?: unknown;
  category?: unknown;
  limit?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as NearbySearchRequest;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusMeters = Number(body.radiusMeters);
    const limit = Math.max(1, Math.min(Number(body.limit) || 100, 100));
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
        || ![500, 1000, 3000].includes(radiusMeters)) {
      return NextResponse.json({ error: "위치 또는 반경 값이 올바르지 않습니다." }, { status: 400 });
    }

    const category = typeof body.category === "string" ? body.category.slice(0, 80).trim() : "";
    const businesses = await searchNearbyStoredRestaurants({
      latitude,
      longitude,
      radiusMeters: radiusMeters as 500 | 1000 | 3000,
      query: typeof body.query === "string" ? body.query.slice(0, 100).trim() : "",
      // The DB field uses source categories; the visible filters group several source labels.
      category: "",
      limit,
    });
    return NextResponse.json({ businesses: businesses.filter(item => matchesRestaurantCategory(item, category)).slice(0, limit), distanceUnit: "m", distanceType: "straight-line" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "주변 음식점을 검색하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
