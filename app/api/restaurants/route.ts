import { NextResponse } from "next/server";
import { listStoredRestaurants } from "../../../lib/supabase/restaurants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const neighborhood = new URL(request.url).searchParams.get("neighborhood") ?? "연남동";
    const businesses = await listStoredRestaurants(neighborhood);
    return NextResponse.json({ businesses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase 음식점 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
