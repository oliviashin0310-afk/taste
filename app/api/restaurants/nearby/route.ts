import { NextResponse } from 'next/server'
import { appCorsOptions, withAppCors } from '../../../../lib/http/cors'
import { fetchNearbyPublicRestaurantData } from '../../../../lib/data/public-restaurants'
import { searchNearbyStoredRestaurants, upsertStoredRestaurants } from '../../../../lib/supabase/restaurants'
import { matchesRestaurantCategory } from '../../../data/categoryFilters'
import type { Restaurant } from '../../../data/restaurants'

export const dynamic = 'force-dynamic'

type NearbySearchRequest = {
  latitude?: unknown
  longitude?: unknown
  radiusMeters?: unknown
  query?: unknown
  category?: unknown
  limit?: unknown
}

type CacheEntry = { expiresAt: number; restaurants: Restaurant[] }
const nearbyCache = new Map<string, CacheEntry>()
const cacheTtlMs = 2 * 60 * 1000

function distanceMeters(latitude: number, longitude: number, item: Restaurant) {
  if (item.latitude == null || item.longitude == null) return Number.POSITIVE_INFINITY
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(item.latitude - latitude)
  const longitudeDelta = radians(item.longitude - longitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(item.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function OPTIONS(request: Request) {
  return appCorsOptions(request)
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as NearbySearchRequest
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)
    const requestedRadiusMeters = Number(body.radiusMeters)
    const limit = Math.max(1, Math.min(Number(body.limit) || 100, 100))
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || ![500, 1000, 3000].includes(requestedRadiusMeters)) {
      return withAppCors(NextResponse.json({ error: '위치 또는 반경 값이 올바르지 않습니다.' }, { status: 400 }), request)
    }
    const radiusMeters = requestedRadiusMeters as 500 | 1000 | 3000

    const cacheKey = [latitude.toFixed(4), longitude.toFixed(4), radiusMeters].join(':')
    let restaurants = nearbyCache.get(cacheKey)?.restaurants
    if (!restaurants || nearbyCache.get(cacheKey)!.expiresAt <= Date.now()) {
      try {
        const result = await fetchNearbyPublicRestaurantData({ latitude, longitude, radiusMeters })
        restaurants = result.businesses
        await upsertStoredRestaurants(restaurants)
        nearbyCache.set(cacheKey, { restaurants, expiresAt: Date.now() + cacheTtlMs })
        if (nearbyCache.size > 100) {
          const now = Date.now()
          for (const [key, value] of nearbyCache) if (value.expiresAt <= now) nearbyCache.delete(key)
        }
      } catch (sourceError) {
        // Use already cached server-side records if the public data service is temporarily unavailable.
        restaurants = await searchNearbyStoredRestaurants({
          latitude,
          longitude,
          radiusMeters: radiusMeters as 500 | 1000 | 3000,
          query: '',
          category: '',
          limit: 100,
        })
        if (!restaurants.length) throw sourceError
      }
    }

    const query = typeof body.query === 'string' ? body.query.slice(0, 100).trim().toLocaleLowerCase() : ''
    const category = typeof body.category === 'string' ? body.category.slice(0, 80).trim() : ''
    const businesses = (restaurants ?? [])
      .map(item => ({ ...item, distanceMeters: distanceMeters(latitude, longitude, item) }))
      .filter(item => item.distanceMeters <= radiusMeters)
      .filter(item => !query || item.name.toLocaleLowerCase().includes(query))
      .filter(item => matchesRestaurantCategory(item, category))
      .sort((a, b) => a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name, 'ko'))
      .slice(0, limit)
      .map(item => ({ ...item, distance: item.distanceMeters / 1000 }))

    return withAppCors(NextResponse.json({
      businesses,
      distanceUnit: 'm',
      distanceType: 'straight-line',
      resultLimit: limit,
    }), request)
  } catch (error) {
    const message = error instanceof Error ? error.message : '주변 음식점을 검색하지 못했습니다.'
    return withAppCors(NextResponse.json({ error: message }, { status: 503 }), request)
  }
}
