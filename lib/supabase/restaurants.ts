import "server-only";

import type { Restaurant } from "../../app/data/restaurants";
import { createServerSupabaseClient } from "./server";

const RESTAURANT_FIELDS = "id,source,source_id,name,address,category,category_label,neighborhood,latitude,longitude,updated_at";

type RestaurantRow = {
  id: string;
  source: string;
  source_id: string;
  name: string;
  address: string;
  category: string;
  category_label: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
};

type NearbyRestaurantRow = RestaurantRow & { distance_meters: number };

function fromRow(row: RestaurantRow, index: number, distanceMeters?: number): Restaurant {
  return {
    id: index + 1,
    source: "public",
    sourceId: row.source_id,
    sourceName: row.source,
    name: row.name,
    address: row.address,
    category: row.category,
    categoryLabel: row.category_label || row.category,
    neighborhood: row.neighborhood,
    description: "",
    color: "#dce8d7",
    emoji: "🍽️",
    distance: distanceMeters === undefined ? 0 : distanceMeters / 1000,
    ...(distanceMeters === undefined ? {} : { distanceMeters }),
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function searchNearbyStoredRestaurants(options: {
  latitude: number;
  longitude: number;
  radiusMeters: 500 | 1000 | 3000;
  query: string;
  category: string;
  limit: number;
}): Promise<Restaurant[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_nearby_restaurants", {
    p_latitude: options.latitude,
    p_longitude: options.longitude,
    p_radius_meters: options.radiusMeters,
    p_query: options.query || null,
    p_category: options.category || null,
    p_limit: options.limit,
  });
  if (error) throw new Error(`Supabase 주변 음식점 검색 실패: ${error.message}`);
  return ((data ?? []) as NearbyRestaurantRow[]).map((row, index) => fromRow(row, index, row.distance_meters));
}

export async function listStoredRestaurants(neighborhood: string): Promise<Restaurant[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select(RESTAURANT_FIELDS)
    .eq("neighborhood", neighborhood)
    .order("name")
    .limit(1000);
  if (error) throw new Error(`Supabase 음식점 목록 조회 실패: ${error.message}`);
  return ((data ?? []) as RestaurantRow[]).map((row, index) => fromRow(row, index));
}

export async function upsertStoredRestaurants(restaurants: Restaurant[]): Promise<void> {
  const supabase = createServerSupabaseClient();
  const collectedAt = new Date().toISOString();
  const rows = restaurants.flatMap(restaurant => {
    if (!restaurant.sourceId || !restaurant.sourceName) return [];
    return [{
      id: `${restaurant.sourceName}:${restaurant.sourceId}`,
      source: restaurant.sourceName,
      source_id: restaurant.sourceId,
      name: restaurant.name,
      address: restaurant.address,
      category: restaurant.category,
      category_label: restaurant.categoryLabel,
      neighborhood: restaurant.neighborhood,
      latitude: restaurant.latitude ?? null,
      longitude: restaurant.longitude ?? null,
      updated_at: collectedAt,
    }];
  });

  if (!rows.length) return;
  const { error } = await supabase
    .from("restaurants")
    .upsert(rows, { onConflict: "source,source_id" });
  if (error) throw new Error(`Supabase 음식점 저장 실패: ${error.message}`);
}
