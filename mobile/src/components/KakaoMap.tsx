import { useEffect, useRef, useState } from 'react'
import type { Restaurant } from '../lib/types'

type LatLng = {}
type MapInstance = {
  setCenter(position: LatLng): void
  panTo(position: LatLng): void
  setLevel(level: number): void
}
type Marker = { setMap(map: MapInstance | null): void }
type KakaoMaps = {
  LatLng: new (lat: number, lng: number) => LatLng
  Map: new (container: HTMLElement, options: { center: LatLng; level: number }) => MapInstance
  Marker: new (options: { map: MapInstance; position: LatLng; title?: string }) => Marker
  event: { addListener(target: Marker | MapInstance, name: string, callback: () => void): void }
  load(callback: () => void): void
}
declare global {
  interface Window { kakao?: { maps: KakaoMaps } }
}

let sdkPromise: Promise<void> | null = null
function loadSdk(key: string) {
  if (window.kakao?.maps) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false'
      script.async = true
      script.onload = () => {
        if (!window.kakao?.maps) {
          reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'))
          return
        }
        window.kakao.maps.load(resolve)
      }
      script.onerror = () => reject(new Error('카카오 지도를 불러오지 못했습니다. 앱 주소를 카카오 개발자 사이트에 등록해 주세요.'))
      document.head.appendChild(script)
    }).catch(error => {
      sdkPromise = null
      throw error
    })
  }
  return sdkPromise
}

type Props = {
  restaurants: Restaurant[]
  location: { latitude: number; longitude: number } | null
  selected: Restaurant | null
  onSelect(item: Restaurant): void
}

export default function KakaoMap({ restaurants, location, selected, onSelect }: Props) {
  const key = import.meta.env.VITE_KAKAO_MAP_KEY
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapInstance | null>(null)
  const markers = useRef<Marker[]>([])
  const userMarker = useRef<Marker | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!key || !container.current) return
    loadSdk(key).then(() => {
      if (cancelled || !container.current || !window.kakao?.maps) return
      const maps = window.kakao.maps
      const center = location
        ? new maps.LatLng(location.latitude, location.longitude)
        : new maps.LatLng(37.562, 126.923)
      map.current = new maps.Map(container.current, { center, level: 5 })
      setError('')
      setRevision(value => value + 1)
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '지도를 표시하지 못했습니다.')
    })
    return () => {
      cancelled = true
      markers.current.forEach(marker => marker.setMap(null))
      markers.current = []
      userMarker.current?.setMap(null)
      userMarker.current = null
      map.current = null
    }
  }, [key, retryCount])

  useEffect(() => {
    if (!map.current || !window.kakao?.maps) return
    markers.current.forEach(marker => marker.setMap(null))
    markers.current = restaurants.flatMap(item => {
      if (item.latitude == null || item.longitude == null) return []
      const maps = window.kakao!.maps
      const marker = new maps.Marker({
        map: map.current!,
        position: new maps.LatLng(item.latitude, item.longitude),
        title: item.name,
      })
      maps.event.addListener(marker, 'click', () => onSelect(item))
      return [marker]
    })
  }, [restaurants, revision, onSelect])

  useEffect(() => {
    if (!map.current || !window.kakao?.maps) return
    userMarker.current?.setMap(null)
    userMarker.current = null
    if (location) {
      const maps = window.kakao.maps
      const point = new maps.LatLng(location.latitude, location.longitude)
      userMarker.current = new maps.Marker({ map: map.current, position: point, title: '현재 내 위치' })
      if (!selected) {
        map.current.setCenter(point)
        map.current.setLevel(5)
      }
    }
    if (selected?.latitude != null && selected.longitude != null) {
      map.current.panTo(new window.kakao.maps.LatLng(selected.latitude, selected.longitude))
      map.current.setLevel(3)
    }
  }, [location, selected, revision])

  if (!key) {
    return <div className="map-placeholder"><span className="map-pin">⌖</span><strong>지도를 연결하려면 설정이 필요해요</strong><p>앱 환경 설정에 카카오 지도 JavaScript 키를 넣고 앱 주소를 등록해 주세요.</p></div>
  }
  return (
    <div className="map-frame">
      <div ref={container} className="map-canvas" aria-label="카카오 지도" />
      {location && <span className="map-badge">내 위치 · 지도를 움직여 확인할 수 있어요</span>}
      {error && <div className="map-error" role="alert"><strong>지도를 표시하지 못했어요</strong><p>{error}</p><button className="button button-small" onClick={() => { setError(''); setRetryCount(value => value + 1) }}>다시 시도</button></div>}
    </div>
  )
}

