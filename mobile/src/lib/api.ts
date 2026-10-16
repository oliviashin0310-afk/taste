import type { Restaurant } from './types'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://taste-ruddy.vercel.app').replace(/\/$/, '')

async function parseResponse(response: Response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || '서버에 연결하지 못했습니다.')
  return result
}

export async function fetchNeighborhood(neighborhood: string, signal?: AbortSignal): Promise<Restaurant[]> {
  const url = new URL(baseUrl + '/api/restaurants')
  url.searchParams.set('neighborhood', neighborhood)
  const result = await parseResponse(await fetch(url, { signal, cache: 'no-store' }))
  return result.businesses as Restaurant[]
}

export async function fetchNearby(options: {
  latitude: number
  longitude: number
  radiusMeters: number
  query: string
  category: string
  signal?: AbortSignal
}): Promise<Restaurant[]> {
  const result = await parseResponse(await fetch(baseUrl + '/api/restaurants/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: options.latitude,
      longitude: options.longitude,
      radiusMeters: options.radiusMeters,
      query: options.query,
      category: options.category,
      limit: 100,
    }),
    signal: options.signal,
  }))
  return result.businesses as Restaurant[]
}
