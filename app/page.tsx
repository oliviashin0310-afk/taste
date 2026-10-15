"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSampleCoordinates, restaurants, type Restaurant } from "./data/restaurants";
import { matchesRestaurantCategory, restaurantFilterCategories } from "./data/categoryFilters";
import KakaoMap from "./components/KakaoMap";
import { CommunityHeaderControls } from "./components/CommunityProvider";
import RestaurantCommunity from "./components/RestaurantCommunity";
import CategoryIcon from "./components/CategoryIcon";

function Icon({ name, size = 20 }: { name: "search" | "pin" | "chevron" | "close" | "locate" | "list" | "map" | "back"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "search") return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>;
  if (name === "pin") return <svg {...common}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
  if (name === "close") return <svg {...common}><path d="m18 6-12 12M6 6l12 12"/></svg>;
  if (name === "locate") return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2"/></svg>;
  if (name === "list") return <svg {...common}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>;
  if (name === "back") return <svg {...common}><path d="m15 18-6-6 6-6"/></svg>;
  return <svg {...common}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3.5 7.8 8.5 4.4 8.5-4.4M12 12.2V21"/></svg>;
}

function distanceKm(from: { latitude: number; longitude: number }, to: { lat: number; lng: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.lat - from.latitude);
  const longitudeDelta = radians(to.lng - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coordinatesFor(item: Restaurant) {
  if (item.latitude !== undefined && item.longitude !== undefined) return { lat: item.latitude, lng: item.longitude };
  return item.source === "public" ? null : getSampleCoordinates(item.id);
}

type LocationStatus = "idle" | "loading" | "success" | "denied" | "timeout" | "unavailable" | "unsupported";

const heroBanners = [
  {
    eyebrow: "YOUR NEIGHBORHOOD, YOUR TABLE",
    title: <>오늘은 <span className="text-[#477754]">어디서</span><br />맛있는 한 끼를 먹을까요?</>,
    description: "동네 가까이에 있는 음식점을 둘러보세요.",
    image: "/banners/neighborhood-meal.webp",
    tint: "#edf3ea",
    background: "bg-[#edf3ea]",
  },
  {
    eyebrow: "FIND YOUR KIND OF FOOD",
    title: <>오늘 땡기는 <span className="text-[#477754]">메뉴</span>를<br />골라보세요.</>,
    description: "업종 필터와 이름 검색으로 원하는 곳을 찾아보세요.",
    image: "/banners/neighborhood-cafe.webp",
    tint: "#f3eee5",
    background: "bg-[#f3eee5]",
  },
  {
    eyebrow: "CLOSE TO YOU",
    title: <>내 주변 <span className="text-[#477754]">가까운 곳</span>을<br />살펴보세요.</>,
    description: "현재 위치에서 500m, 1km, 3km 범위로 찾아볼 수 있어요.",
    image: "/banners/neighborhood-street.webp",
    tint: "#f3ece9",
    background: "bg-[#f3ece9]",
  },
];

function RestaurantCard({ item, onClick, nearbyMode }: { item: Restaurant; onClick: () => void; nearbyMode: boolean }) {
  const distance = nearbyMode ? item.distance < 1 ? `${Math.round(item.distance * 1000)}m` : `${item.distance.toFixed(2)}km` : `${item.distance.toFixed(1)}km`;
  return <button onClick={onClick} className="group flex w-full items-center gap-4 border-b border-[#eceee9] py-4 text-left transition hover:bg-[#fcfdfb]">
    <span className="flex h-[76px] w-[82px] shrink-0 items-center justify-center rounded-[18px] text-[34px]" style={{ backgroundColor: item.color }}>{item.emoji}</span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2"><strong className="truncate text-[16px] font-semibold tracking-[-.04em] text-[#252a26]">{item.name}</strong><span className="rounded-full bg-[#f0f2ed] px-2 py-0.5 text-[10px] font-medium text-[#737a73]">{item.source === "public" ? "공공데이터" : "샘플"}</span></span>
      <span className="mt-1 block text-[12px] text-[#758077]">{item.categoryLabel} <span className="px-1 text-[#c8cdc7]">·</span> {item.neighborhood}</span>
      <span className="mt-2 flex items-center gap-1 text-[11px] text-[#9ba19b]"><Icon name="pin" size={13}/>{item.source === "public" && !coordinatesFor(item) && <>좌표 없음 <span className="px-0.5">·</span> </>}{(nearbyMode || item.source !== "public") && <>{distance} <span className="px-0.5">·</span> </>}{item.address}</span>
    </span><Icon name="chevron" size={17}/>
  </button>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [radius, setRadius] = useState(3);
  const [view, setView] = useState<"list" | "map">("list");
  const [detail, setDetail] = useState<Restaurant | null>(null);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [area, setArea] = useState("마포구 연남동");
  const [areaOpen, setAreaOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [dataSource, setDataSource] = useState<"sample" | "public">("public");
  const [publicRestaurants, setPublicRestaurants] = useState<Restaurant[] | null>(null);
  const [nearbySearchResult, setNearbySearchResult] = useState<{ key: string; businesses: Restaurant[]; error?: string } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [activeBanner, setActiveBanner] = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);
  const activeRestaurants = useMemo(() => dataSource === "public" ? publicRestaurants ?? [] : restaurants, [dataSource, publicRestaurants]);
  const categoryOptions = restaurantFilterCategories;
  const nearbyMode = locationStatus === "success" && currentLocation !== null;
  const neighborhood = area.split(" ").at(-1);
  const nearbySearchKey = nearbyMode && currentLocation && dataSource === "public"
    ? `${currentLocation.latitude},${currentLocation.longitude}|${radius}|${query}|${category}`
    : null;
  const currentNearbyResult = nearbySearchResult?.key === nearbySearchKey ? nearbySearchResult : null;
  const nearbySearchLoading = nearbySearchKey !== null && currentNearbyResult === null;
  useEffect(() => {
    if (bannerPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setActiveBanner(index => (index + 1) % heroBanners.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [bannerPaused]);
  useEffect(() => {
    if (!nearbySearchKey || !currentLocation) return;
    const controller = new AbortController();
    void fetch("/api/restaurants/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusMeters: radius * 1000,
        query,
        category,
        limit: 100,
      }),
      signal: controller.signal,
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "주변 음식점을 검색하지 못했습니다.");
      setNearbySearchResult({ key: nearbySearchKey, businesses: result.businesses as Restaurant[] });
    }).catch(error => {
      if (controller.signal.aborted) return;
      setNearbySearchResult({ key: nearbySearchKey, businesses: [], error: error instanceof Error ? error.message : "주변 음식점을 검색하지 못했습니다." });
    });
    return () => controller.abort();
  }, [nearbySearchKey, currentLocation, radius, query, category]);
  const filtered = useMemo(() => {
    if (nearbyMode && dataSource === "public") return currentNearbyResult?.businesses ?? [];
    const matches = activeRestaurants.filter(r => matchesRestaurantCategory(r, category) && `${r.name} ${r.category} ${r.categoryLabel} ${r.neighborhood}`.toLowerCase().includes(query.toLowerCase()));
    if (nearbyMode && currentLocation) {
      return matches.map(item => ({ item, point: coordinatesFor(item) }))
        .filter((entry): entry is { item: Restaurant; point: { lat: number; lng: number } } => entry.point !== null)
        .map(({ item, point }) => ({ ...item, distance: distanceKm(currentLocation, point) }))
        .filter(item => item.distance <= radius).sort((a, b) => a.distance - b.distance);
    }
    return matches.filter(item => item.neighborhood === neighborhood && (dataSource === "public" || item.distance <= radius));
  }, [activeRestaurants, category, currentLocation, currentNearbyResult, dataSource, nearbyMode, neighborhood, query, radius]);
  const mapRestaurants = useMemo(() => {
    if (!detail || detail.id !== focusedId || filtered.some(item => item.id === detail.id)) return filtered;
    return [...filtered, detail];
  }, [detail, filtered, focusedId]);
  const loadPublicData = async (selectedNeighborhood: string) => {
    setDataLoading(true); setDataMessage(""); setDataSource("public"); setPublicRestaurants([]);
    try {
      const response = await fetch(`/api/restaurants?neighborhood=${encodeURIComponent(selectedNeighborhood)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "공공데이터를 불러오지 못했습니다.");
      setPublicRestaurants(result.businesses as Restaurant[]); setDataSource("public"); setCategory("전체");
      setDataMessage(result.businesses.length ? "" : `${selectedNeighborhood}에는 아직 등록된 음식점이 없어요.`);
    } catch (error) {
      console.error("음식점 정보를 불러오지 못했습니다.", error);
      setDataMessage("음식점 정보를 불러오지 못했어요. 잠시 후 새로고침해 주세요.");
    } finally { setDataLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPublicData("연남동"); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const requestLocation = (preserveSelection = false) => {
    setNotice(""); setLocationMessage(""); if (!preserveSelection) setDataSource("public");
    if (!navigator.geolocation) {
      setCurrentLocation(null); setLocationStatus("unsupported");
      setLocationMessage("이 브라우저는 위치 기능을 지원하지 않습니다. 지역을 직접 선택해 주세요."); return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(position => {
      setCurrentLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
      setLocationStatus("success"); setLocationMessage(""); if (!preserveSelection) setFocusedId(null); setView("map");
      const accuracy = Math.round(position.coords.accuracy);
      setNotice(accuracy > 1000 ? `위치 오차 범위가 약 ${Math.round(accuracy / 100) / 10}km예요. 기기의 위치 설정을 확인해 주세요.` : `현재 위치를 표시했어요. 브라우저가 알려준 위치 정확도는 약 ${accuracy}m입니다.`);
    }, error => {
      setCurrentLocation(null);
      if (error.code === error.PERMISSION_DENIED) {
        setLocationStatus("denied"); setLocationMessage("위치 권한이 거부되었습니다. 지역을 직접 선택해 주세요.");
      } else if (error.code === error.TIMEOUT) {
        setLocationStatus("timeout"); setLocationMessage("위치 확인 시간이 초과되었습니다. 다시 시도하거나 지역을 직접 선택해 주세요.");
      } else {
        setLocationStatus("unavailable"); setLocationMessage("현재 위치를 확인할 수 없습니다. 기기 위치 설정을 확인하거나 지역을 직접 선택해 주세요.");
      }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };
  const selectRestaurant = (item: Restaurant) => { setFocusedId(item.id); setDetail(item); setView("map"); if (!currentLocation) requestLocation(true); };

  return <main className="min-h-screen bg-[#fafbf8]">
    <header className="sticky top-0 z-20 border-b border-[#e9ebe6] bg-[#fafbf8]/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-2 px-3 sm:px-5 md:px-10">
        <Link href="/" onClick={() => { setDetail(null); setView("list"); setFocusedId(null); }} className="flex shrink-0 items-center gap-2 sm:gap-2.5" aria-label="동네식탁 메인으로 이동"><span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-[#356b4a] text-white sm:h-9 sm:w-9 sm:rounded-[13px]"><svg className="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 10.5c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M4 11h16l-1.2 7.2a2 2 0 0 1-2 1.7H7.2a2 2 0 0 1-2-1.7L4 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 14.5h.01M12 14.5h.01M16 14.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span><span className="whitespace-nowrap text-[16px] font-bold tracking-[-.07em] sm:text-[19px]">동네식탁</span></Link>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2"><button onClick={() => setAreaOpen(true)} className="flex min-w-0 max-w-[72px] items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-2 text-[8px] font-medium text-[#4c554e] hover:bg-[#eff2ec] sm:max-w-none sm:px-2.5 sm:text-[9px]"><Icon name="pin" size={14}/><span className="truncate sm:hidden">{area.split(" ").at(-1)}</span><span className="hidden sm:inline">{area}</span><svg className="h-3 w-3 shrink-0 text-[#9da49d]" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button><button onClick={() => requestLocation()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e5e8e2] text-[#50705a] hover:bg-white sm:h-9 sm:w-9" aria-label="현재 위치"><Icon name="locate" size={16}/></button><CommunityHeaderControls /></div>
      </div>
    </header>

    <div className="mx-auto max-w-[960px] px-5 pb-20 pt-2 md:px-10 md:pt-8">
      <section className="min-w-0">
        <div className="relative mb-2 md:mb-8"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b948c]"><Icon name="search" size={17}/></span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="음식점 이름이나 메뉴를 검색해 보세요" className="h-[39px] w-full rounded-[12px] border border-[#e6e9e3] bg-white pl-12 pr-12 text-[12px] leading-none outline-none transition placeholder:text-[12px] placeholder:text-[#a7ada7] focus:border-[#7da184] focus:ring-4 focus:ring-[#edf4ed]"/>{query && <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#899189]"><Icon name="close" size={16}/></button>}</div>
        <div className="mb-7">
          <div className="relative overflow-hidden rounded-[26px]" onMouseEnter={() => setBannerPaused(true)} onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setBannerPaused(false); }} onFocus={() => setBannerPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setBannerPaused(false); }} role="region" aria-roledescription="carousel" aria-label="동네식탁 소개 배너">
            <div className="flex transition-transform duration-700 ease-in-out motion-reduce:transition-none" style={{ transform: `translateX(-${activeBanner * 100}%)` }}>
              {heroBanners.map((banner, index) => <article key={banner.eyebrow} className={`relative flex min-h-[205px] min-w-full items-center overflow-hidden px-6 py-6 md:min-h-[225px] md:px-12 ${banner.background}`} aria-label={`${index + 1} / ${heroBanners.length}`}>
                <div className="absolute inset-0" aria-hidden="true">
                  <Image src={banner.image} alt="" fill sizes="(max-width: 960px) 100vw, 960px" loading={index === 0 ? "eager" : "lazy"} className="object-cover object-center" />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${banner.tint} 0%, ${banner.tint}f2 38%, ${banner.tint}9c 58%, transparent 88%)` }} />
                </div>
                <div className="relative z-10 max-w-[600px] -translate-y-2 pr-[76px] md:pr-0">
                  <h1 className="text-[23px] font-semibold leading-[1.35] tracking-[-.075em] text-[#252a26] md:text-[35px]">{banner.title}</h1>
                  <p className="mt-3 max-w-[440px] text-[11px] leading-5 text-[#737d73] md:text-[12px]">{banner.description}</p>
                </div>
                <span className="absolute right-4 top-3 z-10 rounded-full bg-black/25 px-2 py-1 text-[9px] text-white/90 backdrop-blur-sm md:right-5 md:top-4">연출 이미지</span>
              </article>)}
            </div>
            <button type="button" onClick={() => setActiveBanner(index => (index + heroBanners.length - 1) % heroBanners.length)} className="absolute bottom-3 right-12 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#58705a] shadow-sm transition hover:bg-white md:bottom-4 md:right-14" aria-label="이전 배너"><Icon name="back" size={16}/></button>
            <button type="button" onClick={() => setActiveBanner(index => (index + 1) % heroBanners.length)} className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#58705a] shadow-sm transition hover:bg-white md:bottom-4 md:right-5" aria-label="다음 배너"><Icon name="chevron" size={16}/></button>
            <div className="absolute bottom-[22px] left-6 flex items-center gap-1.5 md:left-12" aria-label="배너 선택">
              {heroBanners.map((banner, index) => <button key={banner.eyebrow} type="button" onClick={() => setActiveBanner(index)} className={`h-1.5 rounded-full transition-all ${index === activeBanner ? "w-6 bg-[#477754]" : "w-1.5 bg-[#477754]/30"}`} aria-label={`${index + 1}번 배너 보기`} aria-current={index === activeBanner ? "true" : undefined}/>) }
            </div>
          </div>
        </div>
        {locationStatus === "loading" && <p className="mb-4 rounded-[12px] bg-[#edf4ed] px-4 py-3 text-[12px] text-[#456b4c]" role="status">브라우저에서 현재 위치를 확인하고 있어요…</p>}
        {locationMessage && <div className="mb-4 flex items-center justify-between gap-3 rounded-[12px] bg-[#fff5ec] px-4 py-3 text-[12px] leading-5 text-[#795a42]" role="alert"><span>{locationMessage}</span><button onClick={() => setAreaOpen(true)} className="shrink-0 rounded-full bg-white px-3 py-1.5 font-medium text-[#5e704f]">지역 선택</button></div>}
        {nearbyMode && <p className="mb-4 rounded-[12px] bg-[#edf4ed] px-4 py-3 text-[12px] leading-5 text-[#456b4c]">{dataSource === "public" ? "PostGIS DB에서 직선거리순 검색 중 · 현재 위치는 저장하지 않습니다." : "직선거리 기준으로 주변 샘플을 정렬합니다 · 현재 위치는 저장하지 않습니다."}</p>}
        {nearbySearchLoading && <p className="mb-3 text-[12px] text-[#7b847b]" role="status">DB에서 반경 내 음식점을 검색하고 있어요…</p>}
        {currentNearbyResult?.error && <p className="mb-3 text-[12px] text-[#a24d3f]" role="alert">{currentNearbyResult.error}</p>}
        <div className="mb-4 grid grid-cols-5 justify-items-center gap-x-3 gap-y-3 pb-2 lg:grid-cols-10" aria-label="업종 선택">{categoryOptions.map(c => { const selected = category === c; return <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={selected} className="flex w-full min-w-0 flex-col items-center gap-1.5 text-center text-[#202520]"><span className={`flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-[16px] transition ${selected ? "bg-[#e4ebe4] shadow-[0_3px_10px_rgba(53,107,74,0.10)]" : "bg-[#f0f1ee] hover:bg-[#e8ebe7]"}`}><CategoryIcon category={c} /></span><span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-tight">{c}</span></button>; })}</div>
        <div className="mb-1 flex items-center justify-between"><div className="flex items-baseline gap-2"><h2 className="text-[17px] font-semibold tracking-[-.05em]">{area.split(" ").at(-1)} 음식점</h2><span className="text-[12px] text-[#969d96]">{filtered.length}곳</span></div><div className="flex items-center rounded-full bg-[#eff1ed] p-0.5"><button onClick={() => setView("list")} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] ${view === "list" ? "bg-white font-semibold text-[#3c6447] shadow-sm" : "text-[#8b928b]"}`}><Icon name="list" size={12}/>목록</button><button onClick={() => setView("map")} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] ${view === "map" ? "bg-white font-semibold text-[#3c6447] shadow-sm" : "text-[#8b928b]"}`}><Icon name="map" size={12}/>지도</button></div></div>
        <div className="mb-1 flex items-end gap-2 border-b border-[#e8ebe5]">{[0.5, 1, 3].map(km => { const selected = radius === km; return <button key={km} onClick={() => setRadius(km)} className={`relative whitespace-nowrap px-2 pb-2 pt-1 text-[11px] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:content-[''] ${selected ? "font-bold text-[#416a4b] after:bg-[#416a4b]" : "font-normal text-[#858d85] after:bg-transparent"}`}>{km < 1 ? "500m" : `${km}km`}</button>; })}<span className="ml-auto pb-2 text-[10px] text-[#a1a7a0]">{nearbyMode ? "현재 위치 직선거리" : dataSource === "public" ? "내 주변 찾기로 거리 필터 적용" : "샘플 거리"}</span></div>
        {view === "list" ? <div>{dataLoading ? <div className="py-16 text-center text-sm text-[#899189]">선택한 동네의 공공데이터를 불러오고 있어요…</div> : filtered.length ? filtered.map(item => <RestaurantCard key={item.sourceId ?? item.id} item={item} nearbyMode={nearbyMode} onClick={() => selectRestaurant(item)}/>) : <div className="py-16 text-center text-sm text-[#899189]">{nearbySearchLoading ? "DB에서 반경 내 음식점을 검색하고 있어요…" : currentNearbyResult?.error ?? (dataSource === "public" && !publicRestaurants?.length ? dataMessage || "선택한 동네의 공공데이터가 없습니다." : "조건에 맞는 음식점이 없어요.")}</div>}</div> : <div className="mt-4"><KakaoMap restaurants={mapRestaurants} selectedId={focusedId} userLocation={currentLocation} onSelect={selectRestaurant}/>{!filtered.length&&<p className="py-4 text-center text-sm text-[#899189]">{nearbySearchLoading ? "DB에서 반경 내 음식점을 검색하고 있어요…" : currentNearbyResult?.error ?? (dataSource === "public" && !publicRestaurants?.length ? dataMessage || "선택한 동네의 공공데이터가 없습니다." : "조건에 맞는 음식점이 없어요.")}</p>}</div>}
        <div className="mt-6 rounded-[14px] bg-[#f0f2ed] px-4 py-3 text-[11px] leading-5 text-[#858d85]">ⓘ {dataSource === "public" ? "업체명, 주소, 업종, 좌표는 공공데이터포털 제공값입니다. 평점·리뷰·영업시간은 표시하지 않습니다." : "화면에 표시된 음식점 정보는 모두 샘플입니다. 실제 위치·운영 여부와 무관하며 평점, 리뷰, 영업시간 정보는 제공하지 않습니다."}</div>
      </section>

    </div>

    {detail && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-0 md:items-center md:p-5" onClick={() => setDetail(null)}><div onClick={e=>e.stopPropagation()} className="max-h-[92vh] w-full max-w-[500px] overflow-y-auto rounded-t-[26px] bg-white p-6 md:rounded-[26px]"><div className="mb-5 flex items-center justify-between"><span className="text-[12px] text-[#8a928a]">음식점 상세</span><button onClick={()=>setDetail(null)}><Icon name="close"/></button></div><div className="flex items-center gap-4"><div className="flex h-[82px] w-[88px] items-center justify-center rounded-[20px] text-[38px]" style={{backgroundColor:detail.color}}>{detail.emoji}</div><div><span className="rounded-full bg-[#f0f2ed] px-2 py-1 text-[10px] text-[#737a73]">{detail.source === "public" ? "공공데이터" : "샘플 데이터"}</span><h2 className="mt-2 text-[22px] font-semibold tracking-[-.06em]">{detail.name}</h2><p className="mt-1 text-[12px] text-[#7d857d]">{detail.categoryLabel} · {detail.neighborhood}</p></div></div>{detail.description && <p className="mt-6 text-[14px] leading-6 text-[#545c55]">{detail.description}</p>}<div className="mt-5 border-t border-[#eceee9] pt-4"><p className="text-[11px] text-[#9ba19b]">주소 {detail.source === "public" ? "(공공데이터)" : "(샘플)"}</p><p className="mt-1 text-[13px]">{detail.address}</p>{detail.sourceId && <p className="mt-3 text-[11px] text-[#899189]">원본 ID {detail.sourceId}</p>}{detail.sourceName && <p className="mt-1 text-[11px] text-[#899189]">출처 {detail.sourceName}</p>}{detail.updatedAt && <p className="mt-1 text-[11px] text-[#899189]">갱신일 {new Date(detail.updatedAt).toLocaleString("ko-KR")}</p>}{detail.source === "public" && <p className="mt-1 text-[11px] text-[#899189]">좌표 {coordinatesFor(detail) ? `${detail.latitude}, ${detail.longitude}` : "제공되지 않음"}</p>}<p className="mt-4 text-[11px] leading-5 text-[#9ba19b]">{detail.source === "public" ? "공개된 원본 ID·업체명·업종·주소·좌표만 표시합니다. 평점, 리뷰, 영업시간 정보는 제공하지 않습니다." : "이 화면은 서비스 시안용 샘플입니다. 실제 주소, 위치, 메뉴 및 운영 정보가 아닙니다."}</p></div><RestaurantCommunity restaurant={detail}/></div></div>}
    {areaOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5" onClick={()=>setAreaOpen(false)}><div onClick={e=>e.stopPropagation()} className="w-full max-w-[360px] rounded-[22px] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">지역 선택</h3><button onClick={()=>setAreaOpen(false)}><Icon name="close" size={18}/></button></div><p className="mt-2 text-[12px] text-[#8a928a]">현재 위치 대신 둘러볼 동네를 선택해 주세요.</p><div className="mt-4 space-y-2">{["마포구 연남동","마포구 성산동","마포구 동교동"].map(a=><button key={a} onClick={()=>{const selectedNeighborhood=a.split(" ").at(-1)??"연남동";setArea(a);setCurrentLocation(null);setLocationStatus("idle");setLocationMessage("");setAreaOpen(false);if(dataSource==="public")void loadPublicData(selectedNeighborhood)}} className={`flex w-full items-center justify-between rounded-[12px] px-4 py-3 text-left text-[13px] ${area===a?"bg-[#edf4ed] font-medium text-[#3e6948]":"bg-[#f7f8f5] text-[#4f574f]"}`}>{a}{area===a&&<span>✓</span>}</button>)}</div></div></div>}
    {notice && <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 rounded-[14px] bg-[#27342a] px-4 py-3 text-center text-[12px] leading-5 text-white shadow-lg" role="status">{notice}<button onClick={()=>setNotice("")} className="ml-3 text-white/70">닫기</button></div>}
  </main>;
}
