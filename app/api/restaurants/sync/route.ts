import { NextResponse } from 'next/server'
import { appCorsOptions, withAppCors } from '../../../../lib/http/cors'
import { fetchPublicRestaurantData } from '../../../../lib/data/public-restaurants'
import { createServerSupabaseClient } from '../../../../lib/supabase/server'
import { listStoredRestaurants, upsertStoredRestaurants } from '../../../../lib/supabase/restaurants'

export const dynamic = 'force-dynamic'

const supportedNeighborhoods = new Set(['연남동', '성산동', '동교동'])

export function OPTIONS(request: Request) {
  return appCorsOptions(request)
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return withAppCors(NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 }), request)

    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return withAppCors(NextResponse.json({ error: '로그인 정보를 확인할 수 없습니다.' }, { status: 401 }), request)
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return withAppCors(NextResponse.json({ error: '관리자만 사용할 수 있습니다.' }, { status: 403 }), request)

    const body = await request.json() as { neighborhood?: unknown }
    const neighborhood = typeof body.neighborhood === 'string' ? body.neighborhood : ''
    if (!supportedNeighborhoods.has(neighborhood)) {
      return withAppCors(NextResponse.json({ error: '지원하지 않는 지역입니다.' }, { status: 400 }), request)
    }

    const { businesses } = await fetchPublicRestaurantData(neighborhood)
    await upsertStoredRestaurants(businesses)
    const storedBusinesses = await listStoredRestaurants(neighborhood)
    return withAppCors(NextResponse.json({ businesses: storedBusinesses, collectedCount: businesses.length }), request)
  } catch (error) {
    const message = error instanceof Error ? error.message : '공공데이터 수집 및 Supabase 저장에 실패했습니다.'
    return withAppCors(NextResponse.json({ error: message }, { status: 502 }), request)
  }
}
