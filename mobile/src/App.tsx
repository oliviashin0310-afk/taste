import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { AppLauncher } from '@capacitor/app-launcher'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import type { Session, User } from '@supabase/supabase-js'
import KakaoMap from './components/KakaoMap'
import { fetchNearby, fetchNeighborhood } from './lib/api'
import { getCurrentLocation, LocationPermissionError, type DeviceLocation } from './lib/location'
import { authRedirectUrl, supabase } from './lib/supabase'
import { categories, matchesCategory, neighborhoods, restaurantKey, type Favorite, type Restaurant } from './lib/types'

type Modal = 'detail' | 'area' | 'auth' | 'favorites' | null
const radiusOptions = [500, 1000, 3000]
const categoryEmoji: Record<string, string> = {
  '전체': '🍽️', '카페/디저트': '☕', '중식': '🍜', '한식': '🍲',
  '패스트푸드': '🍔', '일식': '🍣', '야식': '🍗', '분식': '🍢',
  '양식': '🍝', '아시안': '🥢',
}

export default function App() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [radius, setRadius] = useState(3000)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [nearby, setNearby] = useState(false)
  const [area, setArea] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [favoriteError, setFavoriteError] = useState('')

  const user: User | null = session?.user ?? null
  const visibleRestaurants = useMemo(() => {
    if (nearby) return restaurants
    return restaurants
      .filter(item => matchesCategory(item, category))
      .filter(item => (item.name + ' ' + item.categoryLabel + ' ' + item.category).toLowerCase().includes(query.trim().toLowerCase()))
  }, [nearby, restaurants, category, query])

  const loadArea = useCallback(async (neighborhood: string) => {
    setArea(neighborhood)
    setLocation(null)
    setNearby(false)
    setModal(null)
    setView('list')
    setSelected(null)
    setLoading(true)
    setError('')
    setLocationMessage('')
    try {
      setRestaurants(await fetchNeighborhood(neighborhood))
    } catch (cause) {
      setRestaurants([])
      setError(cause instanceof Error ? cause.message : '음식점 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const findNearby = useCallback(async () => {
    setLocationLoading(true)
    setLocationMessage('')
    setError('')
    try {
      const nextLocation = await getCurrentLocation()
      setLocation(nextLocation)
      setNearby(true)
      setArea(null)
      setSelected(null)
      setView('list')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했습니다.'
      setLocationMessage(message)
      if (cause instanceof LocationPermissionError) setModal('area')
    } finally {
      setLocationLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!nearby || !location) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      void fetchNearby({
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: radius,
        query: query.trim(),
        category,
        signal: controller.signal,
      }).then(items => {
        setRestaurants(items)
        setError(items.length ? '' : '이 거리 안에서 찾은 음식점이 없어요. 범위를 넓히거나 동네를 직접 골라보세요.')
      }).catch(cause => {
        if (!controller.signal.aborted) {
          setRestaurants([])
          setError(cause instanceof Error ? cause.message : '주변 음식점을 불러오지 못했습니다.')
        }
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    }, query ? 350 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [nearby, location, radius, query, category, retryCount])

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setFavorites([])
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !user) {
      setFavorites([])
      return
    }
    let cancelled = false
    setFavoriteLoading(true)
    setFavoriteError('')
    void supabase.from('restaurant_favorites')
      .select('id,restaurant_key,restaurant_name,restaurant_address,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        if (queryError) setFavoriteError('즐겨찾기를 불러오지 못했습니다.')
        else setFavorites((data ?? []) as Favorite[])
      })
      .then(() => { if (!cancelled) setFavoriteLoading(false) })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let backListener: { remove(): Promise<void> } | undefined
    void CapacitorApp.addListener('backButton', () => {
      if (modal) {
        setModal(null)
        return
      }
      if (selected) {
        setSelected(null)
        return
      }
      if (view === 'map') {
        setView('list')
        return
      }
      void CapacitorApp.exitApp()
    }).then(listener => { backListener = listener })
    return () => { void backListener?.remove() }
  }, [modal, selected, view])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let urlListener: { remove(): Promise<void> } | undefined
    const handleUrl = async (url: string | undefined) => {
      if (!url || !url.startsWith('taste://auth/callback') || !supabase) return
      const callback = new URL(url)
      const code = callback.searchParams.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) setAuthMessage('앱 로그인 확인을 마치지 못했습니다. 다시 로그인해 주세요.')
        else {
          setAuthMessage('로그인이 완료됐습니다.')
          setModal(null)
        }
      } else {
        const accessToken = callback.hash.match(/access_token=([^&]+)/)?.[1]
        const refreshToken = callback.hash.match(/refresh_token=([^&]+)/)?.[1]
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: decodeURIComponent(accessToken),
            refresh_token: decodeURIComponent(refreshToken),
          })
          if (sessionError) setAuthMessage('앱 로그인 확인을 마치지 못했습니다.')
          else setModal(null)
        }
      }
    }
    void CapacitorApp.getLaunchUrl().then(result => handleUrl(result?.url))
    void CapacitorApp.addListener('appUrlOpen', event => handleUrl(event.url)).then(listener => { urlListener = listener })
    return () => { void urlListener?.remove() }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let stateListener: { remove(): Promise<void> } | undefined
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!supabase) return
      if (isActive) supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    }).then(listener => { stateListener = listener })
    return () => { void stateListener?.remove() }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const openExternalLinks = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement) || !/^https?:/.test(link.href)) return
      if (link.hostname === window.location.hostname) return
      event.preventDefault()
      void AppLauncher.openUrl({ url: link.href }).catch(() => Browser.open({ url: link.href }))
    }
    document.addEventListener('click', openExternalLinks)
    return () => document.removeEventListener('click', openExternalLinks)
  }, [])

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthMessage('')
    if (!supabase) {
      setAuthMessage('앱 환경 설정에 Supabase 주소와 공개 키를 넣어야 로그인할 수 있어요.')
      setAuthLoading(false)
      return
    }
    try {
      const result = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl } })
      if (result.error) setAuthMessage(result.error.message)
      else if (authMode === 'signup' && !result.data.session) {
        setAuthMessage('가입 확인 메일을 보냈어요. 메일에서 확인한 뒤 앱으로 돌아오면 로그인됩니다.')
      } else {
        setAuthMessage('로그인됐어요.')
        setModal(null)
      }
    } catch (cause) {
      setAuthMessage(cause instanceof Error ? cause.message : '로그인 요청에 실패했습니다.')
    } finally {
      setAuthLoading(false)
    }
  }

  const toggleFavorite = async (item: Restaurant) => {
    if (!user) {
      setAuthMode('login')
      setAuthMessage('즐겨찾기를 사용하려면 먼저 로그인해 주세요.')
      setModal('auth')
      return
    }
    if (!supabase) return
    const key = restaurantKey(item)
    const existing = favorites.find(favorite => favorite.restaurant_key === key)
    setFavoriteError('')
    if (existing) {
      const { error: removeError } = await supabase.from('restaurant_favorites')
        .delete().eq('id', existing.id).eq('user_id', user.id)
      if (removeError) setFavoriteError('즐겨찾기를 삭제하지 못했습니다.')
      else setFavorites(items => items.filter(favorite => favorite.id !== existing.id))
    } else {
      const { data, error: insertError } = await supabase.from('restaurant_favorites')
        .insert({
          user_id: user.id,
          restaurant_key: key,
          restaurant_name: item.name,
          restaurant_address: item.address,
        })
        .select('id,restaurant_key,restaurant_name,restaurant_address,created_at')
        .single()
      if (insertError) setFavoriteError('즐겨찾기에 저장하지 못했습니다.')
      else setFavorites(items => [data as Favorite, ...items])
    }
  }

  const openDirections = async (item: Restaurant) => {
    const destination = item.latitude != null && item.longitude != null
      ? item.latitude + ',' + item.longitude
      : encodeURIComponent(item.name + ' ' + item.address)
    let url = 'https://map.kakao.com/link/search/' + encodeURIComponent(item.name + ' ' + item.address)
    if (Capacitor.getPlatform() === 'ios') {
      url = item.latitude != null && item.longitude != null
        ? 'https://maps.apple.com/?daddr=' + destination + '&dirflg=d'
        : 'https://maps.apple.com/?q=' + destination
    } else if (Capacitor.getPlatform() === 'android' && item.latitude != null && item.longitude != null) {
      url = 'geo:' + destination + '?q=' + destination + '(' + encodeURIComponent(item.name) + ')'
    }
    try {
      if (Capacitor.isNativePlatform()) await AppLauncher.openUrl({ url })
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      await Browser.open({ url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.name + ' ' + item.address) })
    }
  }

  const openRestaurant = (item: Restaurant) => {
    setSelected(item)
    setModal('detail')
  }

  const retry = () => {
    if (nearby && location) setRetryCount(value => value + 1)
    else if (area) void loadArea(area)
  }

  const closeTop = () => {
    if (modal) setModal(null)
    else setSelected(null)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">⌂</span><strong>동네식탁</strong></div>
        <button className="icon-button" aria-label="내 위치 찾기" onClick={() => void findNearby()} disabled={locationLoading}>
          {locationLoading ? <span className="spinner small" /> : '⌖'}
        </button>
        <button className="login-button" onClick={() => user ? setModal('favorites') : setModal('auth')}>
          {user ? '즐겨찾기' : '로그인'}
        </button>
      </header>

      <section className="content">
        <label className="searchbox">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="음식점 이름이나 메뉴를 검색해 보세요" />
          {query && <button aria-label="검색어 지우기" onClick={() => setQuery('')}>×</button>}
        </label>

        <div className="location-actions">
          <button className="button button-primary" onClick={() => void findNearby()} disabled={locationLoading}>
            {locationLoading ? <><span className="spinner small" /> 위치 확인 중</> : '⌖ 내 주변 찾기'}
          </button>
          <button className="button" onClick={() => setModal('area')}>동네 직접 선택</button>
        </div>

        {locationMessage && <div className="notice" role="status"><span>{locationMessage}</span><button onClick={() => setModal('area')}>동네 선택</button></div>}

        <div className="category-grid" aria-label="업종 필터">
          {categories.map(item => (
            <button key={item} className={'category-chip' + (category === item ? ' selected' : '')} aria-pressed={category === item} onClick={() => setCategory(item)}>
              <span>{categoryEmoji[item]}</span><small>{item}</small>
            </button>
          ))}
        </div>

        <div className="results-head">
          <div><h1>{nearby ? '내 주변 음식점' : area ? area + ' 음식점' : '주변 음식점 찾기'}</h1><span>{loading ? '불러오는 중' : visibleRestaurants.length + '곳'}</span></div>
          <div className="view-switch" role="group" aria-label="보기 방식">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>목록</button>
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>지도</button>
          </div>
        </div>

        <div className="radius-tabs" role="group" aria-label="검색 거리">
          {radiusOptions.map(option => <button key={option} className={radius === option ? 'active' : ''} onClick={() => setRadius(option)}>
            {option < 1000 ? option + 'm' : option / 1000 + 'km'}
          </button>)}
          <span>{nearby ? '현재 위치 기준' : '거리 선택'}</span>
        </div>

        {view === 'map' ? (
          <KakaoMap restaurants={visibleRestaurants} location={location} selected={selected} onSelect={openRestaurant} />
        ) : null}

        {loading ? (
          <div className="state-card" role="status"><span className="spinner" /><strong>음식점을 불러오고 있어요</strong><p>잠시만 기다려 주세요.</p></div>
        ) : error ? (
          <div className="state-card error-card" role="alert"><span className="state-icon">!</span><strong>불러오지 못했어요</strong><p>{error}</p><button className="button button-primary" onClick={retry}>다시 시도</button></div>
        ) : visibleRestaurants.length ? (
          view === 'list' ? <div className="restaurant-list">
            {visibleRestaurants.map(item => <button key={item.sourceId || item.id} className="restaurant-row" onClick={() => openRestaurant(item)}>
              <span className="food-thumb" style={{ backgroundColor: item.color }}>{item.emoji || '🍽️'}</span>
              <span className="restaurant-info"><strong>{item.name}</strong><small>{item.categoryLabel} · {item.neighborhood}</small><small className="muted">{item.distanceMeters != null ? Math.round(item.distanceMeters) + 'm · ' : ''}{item.address}</small></span>
              <span className="row-arrow">›</span>
            </button>)}
          </div> : <p className="map-footnote">{visibleRestaurants.length}곳이 지도에 표시되어 있어요. 음식점 표식을 누르면 상세 정보를 볼 수 있습니다.</p>
        ) : !loading && !error ? (
          <div className="state-card"><span className="state-icon">⌖</span><strong>{nearby ? '주변 검색 결과가 아직 없어요' : '먼저 위치나 동네를 선택해 주세요'}</strong><p>{nearby ? '다른 거리로 검색하거나, 동네를 직접 골라보세요.' : '현재 위치를 찾거나 원하는 동네를 직접 선택할 수 있어요.'}</p>
            {!nearby && <button className="button button-primary" onClick={() => setModal('area')}>동네 선택</button>}
          </div>
        ) : null}
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeTop() }}>
        {modal === 'detail' && selected && <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div className="sheet-handle" /><div className="sheet-header"><span>음식점 상세</span><button className="close-button" aria-label="닫기" onClick={closeTop}>×</button></div>
          <div className="detail-hero"><span className="detail-emoji" style={{ backgroundColor: selected.color }}>{selected.emoji || '🍽️'}</span><div><small>{selected.source === 'public' ? '공공데이터' : '음식점'}</small><h2 id="detail-title">{selected.name}</h2><p>{selected.categoryLabel} · {selected.neighborhood}</p></div></div>
          <div className="detail-address"><small>주소</small><p>{selected.address || '주소 정보가 없습니다.'}</p></div>
          <div className="detail-actions"><button className="button button-primary" onClick={() => void openDirections(selected)}>길찾기</button><button className="button" onClick={() => void toggleFavorite(selected)}>{favorites.some(item => item.restaurant_key === restaurantKey(selected)) ? '♥ 저장됨' : '♡ 즐겨찾기'}</button></div>
          <p className="detail-note">외부 지도 앱에서 길찾기를 엽니다. 음식점 좌표가 없으면 이름과 주소로 검색합니다.</p>
        </section>}

        {modal === 'area' && <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="area-title">
          <div className="sheet-header"><div><small>현재 위치 대신</small><h2 id="area-title">동네를 선택해 주세요</h2></div><button className="close-button" aria-label="닫기" onClick={closeTop}>×</button></div>
          <div className="area-options">{neighborhoods.map(item => <button key={item} onClick={() => void loadArea(item)}>{item}<span>›</span></button>)}</div>
          <p className="dialog-note">현재 서버에 음식점 데이터가 준비된 동네만 표시합니다.</p>
        </section>}

        {modal === 'auth' && <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <div className="sheet-header"><div><small>동네식탁 회원</small><h2 id="auth-title">{authMode === 'login' ? '로그인' : '회원가입'}</h2></div><button className="close-button" aria-label="닫기" onClick={closeTop}>×</button></div>
          <form className="auth-form" onSubmit={submitAuth}>
            <label>이메일<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
            <label>비밀번호<input required type="password" minLength={8} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /><small>8자 이상</small></label>
            <button className="button button-primary full-width" disabled={authLoading}>{authLoading ? '처리 중…' : authMode === 'login' ? '로그인' : '가입하고 이메일 확인'}</button>
          </form>
          {authMessage && <p className="form-message" role="status">{authMessage}</p>}
          <button className="text-button full-width" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthMessage('') }}>{authMode === 'login' ? '처음 오셨나요? 회원가입' : '이미 계정이 있나요? 로그인'}</button>
        </section>}

        {modal === 'favorites' && <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="favorites-title">
          <div className="sheet-header"><div><small>내 계정</small><h2 id="favorites-title">즐겨찾기</h2></div><button className="close-button" aria-label="닫기" onClick={closeTop}>×</button></div>
          {favoriteLoading ? <div className="state-card compact-state"><span className="spinner" /><p>즐겨찾기를 불러오고 있어요.</p></div> : favorites.length ? <ul className="favorite-list">{favorites.map(favorite => <li key={favorite.id}><div><strong>{favorite.restaurant_name}</strong><small>{favorite.restaurant_address || '주소 정보 없음'}</small></div><button className="remove-button" onClick={() => { if (supabase && user) void supabase.from('restaurant_favorites').delete().eq('id', favorite.id).eq('user_id', user.id).then(({ error: removeError }) => { if (!removeError) setFavorites(items => items.filter(item => item.id !== favorite.id)); else setFavoriteError('즐겨찾기를 삭제하지 못했습니다.') }) }}>삭제</button></li>)}</ul> : <div className="state-card compact-state"><p>아직 저장한 음식점이 없습니다.</p></div>}
          {favoriteError && <p className="form-message" role="alert">{favoriteError}</p>}
          <button className="button signout-button" onClick={() => { if (supabase) void supabase.auth.signOut(); setModal(null) }}>로그아웃</button>
        </section>}
      </div>}
    </main>
  )
}
