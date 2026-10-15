"use client";

import { useEffect, useRef, useState } from "react";
import { getSampleCoordinates, type Restaurant } from "../data/restaurants";

function coordinatesFor(item: Restaurant) {
  if (item.latitude !== undefined && item.longitude !== undefined) return { lat: item.latitude, lng: item.longitude };
  return item.source === "public" ? null : getSampleCoordinates(item.id);
}

type LatLng = { };
type Bounds = { extend: (point: LatLng) => void };
type KakaoMap = { setCenter: (center: LatLng) => void; panTo: (center: LatLng) => void; setLevel: (level: number) => void; setBounds: (bounds: Bounds, padding?: number) => void };
type Marker = { setMap: (map: KakaoMap | null) => void };
type KakaoMaps = {
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new () => Bounds;
  Map: new (container: HTMLElement, options: { center: LatLng; level: number }) => KakaoMap;
  Marker: new (options: { map: KakaoMap; position: LatLng; title?: string }) => Marker;
  InfoWindow: new (options: { content: HTMLElement; removable?: boolean }) => { open: (map: KakaoMap, marker: Marker) => void; close: () => void };
  event: { addListener: (target: Marker | KakaoMap, type: string, callback: () => void) => void };
  load: (callback: () => void) => void;
};
declare global { interface Window { kakao?: { maps: KakaoMaps } } }

let sdkPromise: Promise<void> | undefined;
function loadKakaoSdk(key: string) {
  if (window.kakao?.maps) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (!window.kakao?.maps) { reject(new Error("카카오 지도 SDK를 초기화하지 못했습니다.")); return; }
      window.kakao.maps.load(resolve);
    };
    script.onerror = () => reject(new Error("카카오 지도 SDK를 불러오지 못했습니다. 키와 등록 도메인을 확인해 주세요."));
    document.head.appendChild(script);
    window.setTimeout(() => reject(new Error("카카오 지도 응답이 지연되고 있습니다. 키와 네트워크를 확인해 주세요.")), 12000);
  }).catch(error => { sdkPromise = undefined; throw error; });
  return sdkPromise;
}

type Props = { restaurants: Restaurant[]; selectedId?: number | null; userLocation?: { latitude: number; longitude: number; accuracy?: number } | null; onSelect?: (item: Restaurant) => void; compact?: boolean };

export default function KakaoMap({ restaurants, selectedId, userLocation = null, onSelect, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const userMarkerRef = useRef<Marker | null>(null);
  const infoRef = useRef<{ open: (map: KakaoMap, marker: Marker) => void; close: () => void } | null>(null);
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const [error, setError] = useState("");
  const [mapRevision, setMapRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!key) return;
    const markers = markersRef.current;
    loadKakaoSdk(key).then(() => {
      if (cancelled || !containerRef.current || !window.kakao) return;
      const maps = window.kakao.maps;
      // These coordinates are deliberately synthetic demo positions, not restaurant locations.
      const map = new maps.Map(containerRef.current, { center: new maps.LatLng(37.562, 126.923), level: 5 });
      mapRef.current = map;
      let loaded = false;
      const tileTimeout = window.setTimeout(() => {
        if (!loaded && !cancelled) setError("지도를 표시하지 못했습니다. 키가 유효한지, http://localhost:3000이 카카오 Developers에 등록되어 있는지 확인해 주세요.");
      }, 10000);
      maps.event.addListener(map, "tilesloaded", () => { loaded = true; window.clearTimeout(tileTimeout); if (!cancelled) setError(""); });
      const info = new maps.InfoWindow({ content: document.createElement("div"), removable: true });
      infoRef.current = info;
      restaurants.forEach(item => {
        const point = coordinatesFor(item);
        if (!point) return;
        const { lat, lng } = point;
        const marker = new maps.Marker({ map, position: new maps.LatLng(lat, lng), title: item.source === "public" ? item.name : `${item.name} (샘플)` });
        markers.set(item.id, marker);
        maps.event.addListener(marker, "click", () => {
          const content = document.createElement("div");
          content.style.cssText = "padding:10px 12px;min-width:150px;font:12px Arial,sans-serif;color:#202521";
          const title = document.createElement("strong"); title.textContent = `${item.emoji} ${item.name}${item.source === "public" ? "" : " · 샘플"}`;
          const category = document.createElement("div"); category.textContent = `${item.categoryLabel} · ${item.neighborhood}`; category.style.cssText = "margin-top:5px;color:#687168";
          content.append(title, category); info.close(); infoRef.current = new maps.InfoWindow({ content, removable: true }); infoRef.current.open(map, marker);
          onSelect?.(item);
        });
      });
      map.setLevel(5);
      setMapRevision(revision => revision + 1);
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "지도를 불러오지 못했습니다."); });
    return () => { cancelled = true; markers.forEach(marker => marker.setMap(null)); markers.clear(); userMarkerRef.current?.setMap(null); userMarkerRef.current = null; mapRef.current = null; };
  // Recreate map markers when the filtered restaurant set changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, restaurants.map(item => `${item.sourceId ?? item.id}`).join(",")]);

  useEffect(() => {
    if (!selectedId || !mapRef.current || !window.kakao) return;
    const item = restaurants.find(restaurant => restaurant.id === selectedId);
    if (!item) return;
    const point = coordinatesFor(item);
    if (!point) return;
    const { lat, lng } = point;
    if (userLocation) {
      const bounds = new window.kakao.maps.LatLngBounds();
      bounds.extend(new window.kakao.maps.LatLng(userLocation.latitude, userLocation.longitude));
      bounds.extend(new window.kakao.maps.LatLng(lat, lng));
      mapRef.current.setBounds(bounds, 72);
    } else {
      mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng));
      mapRef.current.setLevel(3);
    }
    const marker = markersRef.current.get(item.id);
    if (marker) {
      const content = document.createElement("div"); content.style.cssText = "padding:9px 11px;font:12px Arial,sans-serif;color:#202521";
      const title = document.createElement("strong"); title.textContent = `${item.emoji} ${item.name}${item.source === "public" ? "" : " · 샘플"}`; content.append(title);
      infoRef.current?.close(); infoRef.current = new window.kakao.maps.InfoWindow({ content, removable: true }); infoRef.current.open(mapRef.current, marker);
    }
  }, [selectedId, restaurants, mapRevision, userLocation]);

  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;
    userMarkerRef.current?.setMap(null);
    userMarkerRef.current = null;
    if (!userLocation) return;
    const position = new window.kakao.maps.LatLng(userLocation.latitude, userLocation.longitude);
    userMarkerRef.current = new window.kakao.maps.Marker({ map: mapRef.current, position, title: "현재 내 위치" });
    const selectedItem = selectedId ? restaurants.find(item => item.id === selectedId) : null;
    const selectedPoint = selectedItem ? coordinatesFor(selectedItem) : null;
    if (selectedPoint) {
      const bounds = new window.kakao.maps.LatLngBounds();
      bounds.extend(position);
      bounds.extend(new window.kakao.maps.LatLng(selectedPoint.lat, selectedPoint.lng));
      mapRef.current.setBounds(bounds, 72);
    } else {
      mapRef.current.setCenter(position);
      mapRef.current.setLevel(4);
    }
  }, [userLocation, mapRevision, selectedId, restaurants]);

  return <div className={`relative overflow-hidden rounded-[20px] border border-[#e5e9e2] bg-[#eef2ec] ${compact ? "h-[210px]" : "h-[420px] md:h-[540px]"}`}>
    <div ref={containerRef} className="h-full w-full" aria-label="카카오 지도" />
    {userLocation && <div className="absolute right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-[10px] font-medium text-[#356b4a] shadow-sm">내 위치 · 정확도 약 {userLocation.accuracy == null ? "확인 중" : `${Math.round(userLocation.accuracy)}m`} · 저장 안 함</div>}
    <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-[10px] text-[#697269] shadow-sm">{restaurants[0]?.source === "public" ? "공공데이터 좌표 · 좌표 없는 업소는 마커 생략" : "샘플 음식점 · 마커 위치는 임의 좌표입니다"}</div>
    {error && <div className="absolute inset-0 flex items-center justify-center bg-[#f2f4ef]/95 p-5"><div className="max-w-[310px] text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#8b7358]">!</div><p className="mt-3 text-[13px] font-semibold text-[#424a42]">지도를 표시할 수 없습니다</p><p className="mt-2 text-[11px] leading-5 text-[#788078]">{error}</p><p className="mt-2 text-[10px] text-[#9ba19b]">카카오 Developers에 개발 주소를 등록했는지도 확인해 주세요.</p></div></div>}
  </div>;
}
