import { NextResponse } from 'next/server'
import { appCorsOptions, withAppCors } from '../../../lib/http/cors'
import { listStoredRestaurants } from '../../../lib/supabase/restaurants'

export const dynamic = 'force-dynamic'

export function OPTIONS(request: Request) {
  return appCorsOptions(request)
}

export async function GET(request: Request) {
  try {
    const neighborhood = new URL(request.url).searchParams.get('neighborhood') ?? '연남동'
    const businesses = await listStoredRestaurants(neighborhood)
    return withAppCors(NextResponse.json({ businesses }), request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Supabase 음식점 정보를 불러오지 못했습니다.'
    return withAppCors(NextResponse.json({ error: message }, { status: 503 }), request)
  }
}
