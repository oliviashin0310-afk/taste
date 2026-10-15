"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "../../lib/supabase/browser";
import type { Restaurant } from "../data/restaurants";

type Favorite = { id: string; restaurant_key: string; restaurant_name: string; restaurant_address: string; created_at: string };
type CommunityContextValue = {
  user: User | null;
  role: string;
  favorites: Favorite[];
  error: string;
  openAuth: () => void;
  openFavorites: () => void;
  removeFavorite: (favorite: Favorite) => Promise<void>;
  signOut: () => Promise<void>;
  toggleFavorite: (restaurant: Restaurant) => Promise<void>;
  isFavorite: (restaurant: Restaurant) => boolean;
  client: ReturnType<typeof getBrowserSupabase> | null;
};

const CommunityContext = createContext<CommunityContextValue | null>(null);
const restaurantKey = (restaurant: Restaurant) => restaurant.source === "public" && restaurant.sourceId ? `public:${restaurant.sourceId}` : `sample:${restaurant.id}`;

export function useCommunity() {
  const context = useContext(CommunityContext);
  if (!context) throw new Error("useCommunity must be used within CommunityProvider");
  return context;
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [supabaseState] = useState(() => {
    if (typeof window === "undefined") return { client: null, initError: "" };
    try { return { client: getBrowserSupabase(), initError: "" }; }
    catch (cause) { return { client: null, initError: cause instanceof Error ? cause.message : "Supabase 인증을 사용할 수 없습니다." }; }
  });
  const client = supabaseState.client;
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("user");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState(supabaseState.initError);
  const [authOpen, setAuthOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  const refreshMemberData = useCallback(async (supabase: NonNullable<typeof client>, member: User | null) => {
    if (!member) { setRole("user"); setFavorites([]); return; }
    const [{ data: profile }, { data: saved, error: savedError }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", member.id).maybeSingle(),
      supabase.from("restaurant_favorites").select("id,restaurant_key,restaurant_name,restaurant_address,created_at").eq("user_id", member.id).order("created_at", { ascending: false }),
    ]);
    if (savedError) setError("회원 기능 설정이 필요합니다. Supabase 마이그레이션을 실행해 주세요.");
    else setError("");
    setRole(profile?.role ?? "user");
    setFavorites((saved ?? []) as Favorite[]);
  }, []);

  useEffect(() => {
    if (!client) return;
    void client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      void refreshMemberData(client, data.user);
    }).catch(() => setError("회원 정보를 확인하지 못했습니다."));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const member = session?.user ?? null;
      setUser(member);
      window.setTimeout(() => void refreshMemberData(client, member), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [client, refreshMemberData]);

  const openAuth = useCallback(() => { setError(""); setAuthOpen(true); }, []);
  const openFavorites = useCallback(() => { setError(""); setFavoritesOpen(true); }, []);
  const signOut = useCallback(async () => {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    setError(signOutError?.message ?? "");
  }, [client]);
  const removeFavorite = useCallback(async (favorite: Favorite) => {
    if (!client || !user) return;
    const { error: removeError } = await client.from("restaurant_favorites").delete().eq("id", favorite.id).eq("user_id", user.id);
    if (removeError) { setError(removeError.message); return; }
    setFavorites(items => items.filter(item => item.id !== favorite.id));
  }, [client, user]);
  const isFavorite = useCallback((restaurant: Restaurant) => favorites.some(item => item.restaurant_key === restaurantKey(restaurant)), [favorites]);
  const toggleFavorite = useCallback(async (restaurant: Restaurant) => {
    if (!user) { openAuth(); return; }
    if (!client) { setError("Supabase 설정을 확인해 주세요."); return; }
    const key = restaurantKey(restaurant);
    if (isFavorite(restaurant)) {
      const current = favorites.find(item => item.restaurant_key === key);
      if (!current) return;
      const { error: deleteError } = await client.from("restaurant_favorites").delete().eq("id", current.id).eq("user_id", user.id);
      if (deleteError) { setError(deleteError.message); return; }
      setFavorites(items => items.filter(item => item.id !== current.id));
    } else {
      const { data, error: insertError } = await client.from("restaurant_favorites").insert({ user_id: user.id, restaurant_key: key, restaurant_name: restaurant.name, restaurant_address: restaurant.address }).select("id,restaurant_key,restaurant_name,restaurant_address,created_at").single();
      if (insertError) { setError(insertError.message); return; }
      setFavorites(items => [data as Favorite, ...items]);
    }
  }, [client, favorites, isFavorite, openAuth, user]);

  const context = useMemo(() => ({ user, role, favorites, error, openAuth, openFavorites, removeFavorite, signOut, toggleFavorite, isFavorite, client }), [user, role, favorites, error, openAuth, openFavorites, removeFavorite, signOut, toggleFavorite, isFavorite, client]);
  return <CommunityContext.Provider value={context}>
    {children}
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
    {favoritesOpen && <FavoritesDialog onClose={() => setFavoritesOpen(false)} />}
  </CommunityContext.Provider>;
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const { client } = useCommunity();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    if (!client) { setMessage("Supabase 공개 URL과 공용 키를 .env.local에 설정해 주세요."); setBusy(false); return; }
    const result = mode === "login"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL || window.location.origin } });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("가입 확인 메일을 보냈습니다. 이메일의 확인 링크를 눌러 가입을 마쳐 주세요.");
    else onClose();
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" className="w-full max-w-[390px] rounded-[24px] bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><div><p className="text-[11px] text-[#78907c]">동네식탁 회원</p><h2 id="auth-dialog-title" className="mt-1 text-[21px] font-semibold">{mode === "login" ? "로그인" : "회원가입"}</h2></div><button onClick={onClose} className="rounded-full p-2 text-[#6c756d] hover:bg-[#f1f3ef]" aria-label="닫기">×</button></div>
      <form onSubmit={submit} className="mt-5 space-y-3"><label className="block text-[12px] text-[#59625a]">이메일<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#e3e8e1] px-3 text-[14px] outline-none focus:border-[#6c9673]" /></label><label className="block text-[12px] text-[#59625a]">비밀번호<input required type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#e3e8e1] px-3 text-[14px] outline-none focus:border-[#6c9673]" /><span className="mt-1 block text-[10px] text-[#929a92]">8자 이상</span></label><button disabled={busy} className="h-11 w-full rounded-full bg-[#356b4a] text-[13px] font-semibold text-white disabled:opacity-50">{busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 이메일 확인"}</button></form>
      {message && <p role="status" className="mt-3 rounded-xl bg-[#f4f6f1] p-3 text-[12px] leading-5 text-[#596b59]">{message}</p>}
      <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }} className="mt-4 w-full text-center text-[12px] text-[#52765a]">{mode === "login" ? "처음 오셨나요? 회원가입" : "이미 계정이 있나요? 로그인"}</button>
      <p className="mt-4 text-[10px] leading-4 text-[#9aa09a]">가입 시 이메일 확인이 필요할 수 있습니다. 인증 메일 주소는 Supabase Auth 설정에서 관리합니다.</p>
    </section>
  </div>;
}

function FavoritesDialog({ onClose }: { onClose: () => void }) {
  const { user, favorites, removeFavorite, openAuth, error } = useCommunity();
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="favorites-dialog-title" className="w-full max-w-[430px] rounded-[24px] bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><div><p className="text-[11px] text-[#78907c]">내 계정</p><h2 id="favorites-dialog-title" className="mt-1 text-[20px] font-semibold">즐겨찾기</h2></div><button onClick={onClose} className="rounded-full p-2 text-[#6c756d] hover:bg-[#f1f3ef]" aria-label="닫기">×</button></div>
      {!user ? <div className="py-8 text-center"><p className="text-[13px] text-[#747d74]">로그인하면 저장한 음식점을 확인할 수 있어요.</p><button onClick={openAuth} className="mt-4 rounded-full bg-[#356b4a] px-5 py-2 text-[12px] font-medium text-white">로그인</button></div> : favorites.length ? <ul className="mt-4 max-h-[55vh] divide-y divide-[#edf0eb] overflow-auto">{favorites.map(item => <li key={item.id} className="flex items-center gap-3 py-3"><span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{item.restaurant_name}</strong><span className="mt-1 block truncate text-[11px] text-[#899189]">{item.restaurant_address || "주소 정보 없음"}</span></span><button onClick={() => void removeFavorite(item)} className="rounded-full border border-[#e5e9e3] px-3 py-1.5 text-[11px] text-[#687268]">삭제</button></li>)}</ul> : <p className="py-10 text-center text-[13px] text-[#899189]">아직 저장한 음식점이 없습니다.</p>}
      {error && <p role="alert" className="mt-3 text-[12px] text-[#a34d3e]">{error}</p>}
    </section>
  </div>;
}

export function CommunityHeaderControls() {
  const { user, role, openAuth, openFavorites, signOut, error } = useCommunity();
  return <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
    {user ? <><button onClick={openFavorites} aria-label="즐겨찾기" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e8e2] text-[12px] text-[#4c554e] hover:bg-white sm:h-auto sm:w-auto sm:px-3 sm:py-2 sm:text-[11px] sm:font-medium"><span className="sm:hidden" aria-hidden="true">♡</span><span className="hidden sm:inline">즐겨찾기</span></button>{role === "admin" && <Link href="/admin/community" className="rounded-full px-1.5 py-2 text-[10px] text-[#4c704f] sm:px-2 sm:text-[11px]">관리</Link>}<button onClick={() => void signOut()} className="whitespace-nowrap rounded-full px-1.5 py-2 text-[10px] text-[#7b837c] sm:px-2 sm:text-[11px]"> <span className="sm:hidden">나가기</span><span className="hidden sm:inline">로그아웃</span></button></> : <button onClick={openAuth} className="flex h-8 items-center whitespace-nowrap rounded-full border border-[#e5e8e2] px-2 text-[7px] font-medium text-[#4c554e] hover:bg-white sm:h-9 sm:px-2.5 sm:text-[8px]">로그인</button>}
    {error && <span className="sr-only" role="status">{error}</span>}
  </div>;
}

export function FavoriteButton({ restaurant, compact = false }: { restaurant: Restaurant; compact?: boolean }) {
  const { user, isFavorite, toggleFavorite } = useCommunity();
  const saved = isFavorite(restaurant);
  return <button type="button" onClick={event => { event.stopPropagation(); void toggleFavorite(restaurant); }} aria-pressed={saved} aria-label={saved ? "즐겨찾기에서 삭제" : "즐겨찾기에 저장"} className={`inline-flex shrink-0 items-center justify-center rounded-full border transition ${compact ? "h-8 w-8" : "gap-2 px-4 py-2.5 text-[12px] font-medium"} ${saved ? "border-[#d6e5d8] bg-[#edf4ed] text-[#356b4a]" : "border-[#e5e8e2] bg-white text-[#647064] hover:border-[#b9cebc]"}`}><span aria-hidden="true">{saved ? "♥" : "♡"}</span>{!compact && (user ? saved ? "저장됨" : "즐겨찾기" : "로그인 후 저장")}</button>;
}

export { restaurantKey };
