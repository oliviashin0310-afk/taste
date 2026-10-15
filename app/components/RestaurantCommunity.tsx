"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import type { Restaurant } from "../data/restaurants";
import { restaurantKey, useCommunity } from "./CommunityProvider";
import { FavoriteButton } from "./CommunityProvider";

type Review = { id: string; user_id: string; content: string; photo_urls: string[]; storage_paths: string[]; moderation_status: "pending" | "visible" | "rejected"; created_at: string };
type ReportReason = "허위 정보" | "욕설·혐오" | "광고·스팸" | "개인정보" | "기타";
const reportReasons: ReportReason[] = ["허위 정보", "욕설·혐오", "광고·스팸", "개인정보", "기타"];

export default function RestaurantCommunity({ restaurant }: { restaurant: Restaurant }) {
  const { client, user, openAuth } = useCommunity();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [reportTarget, setReportTarget] = useState<{ type: "review" | "restaurant"; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("기타");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const key = restaurantKey(restaurant);
  const canReview = restaurant.source === "public" && Boolean(restaurant.sourceId);

  const loadReviews = useCallback(async () => {
    if (!client || !canReview) return;
    setLoading(true);
    const { data, error } = await client.from("restaurant_reviews").select("id,user_id,content,photo_urls,moderation_status,created_at").eq("restaurant_key", key).order("created_at", { ascending: false }).limit(50);
    if (error) setMessage("리뷰를 불러오지 못했습니다. Supabase 설정을 확인해 주세요.");
    else {
      const rows = data ?? [];
      const paths = rows.flatMap(row => (row.photo_urls ?? []) as string[]);
      const { data: signedPhotos } = paths.length ? await client.storage.from("community-review-photos").createSignedUrls(paths, 3600) : { data: [] };
      const signedByPath = new Map((signedPhotos ?? []).map(photo => [photo.path, photo.signedUrl]));
      setReviews(rows.map(row => {
        const storagePaths = (row.photo_urls ?? []) as string[];
        return { ...row, storage_paths: storagePaths, photo_urls: storagePaths.map(path => signedByPath.get(path) ?? "").filter(Boolean) } as Review;
      }));
    }
    setLoading(false);
  }, [client, canReview, key]);

  useEffect(() => { const timer = window.setTimeout(() => void loadReviews(), 0); return () => window.clearTimeout(timer); }, [loadReviews]);

  const submitReview = async (event: FormEvent) => {
    event.preventDefault(); setMessage("");
    if (!user) { openAuth(); return; }
    if (!client) { setMessage("Supabase 설정을 확인해 주세요."); return; }
    if (!canReview) { setMessage("공공데이터로 확인된 음식점에만 리뷰를 등록할 수 있습니다."); return; }
    const trimmed = content.trim();
    if (trimmed.length < 5 || trimmed.length > 2000) { setMessage("리뷰는 5자 이상 2,000자 이하로 작성해 주세요."); return; }
    if (photos.length > 3) { setMessage("사진은 최대 3장까지 등록할 수 있습니다."); return; }
    setSubmitting(true);
    const uploadedPaths: string[] = [];
    try {
      const photoPaths: string[] = [];
      for (const photo of photos) {
        if (!photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024) throw new Error("JPG, PNG, WebP 이미지 파일을 장당 5MB 이하로 올려 주세요.");
        const extension = photo.type === "image/jpeg" ? "jpg" : photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "";
        if (!extension) throw new Error("JPG, PNG, WebP 형식만 등록할 수 있습니다.");
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from("community-review-photos").upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        photoPaths.push(path);
      }
      const { error: insertError } = await client.from("restaurant_reviews").insert({ user_id: user.id, restaurant_key: key, restaurant_name: restaurant.name, content: trimmed, photo_urls: photoPaths, moderation_status: "pending" });
      if (insertError) throw insertError;
      setContent(""); setPhotos([]);
      const input = document.getElementById("community-review-photos") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("리뷰가 등록되었습니다. 공개 전 관리자 검토를 진행합니다.");
      await loadReviews();
    } catch (cause) {
      if (uploadedPaths.length) await client.storage.from("community-review-photos").remove(uploadedPaths);
      setMessage(cause instanceof Error ? cause.message : "리뷰를 등록하지 못했습니다.");
    } finally { setSubmitting(false); }
  };

  const submitReport = async (event: FormEvent) => {
    event.preventDefault(); setReportMessage("");
    if (!user) { setReportTarget(null); openAuth(); return; }
    if (!client || !reportTarget) return;
    const { error } = await client.from("community_reports").insert({ reporter_id: user.id, target_type: reportTarget.type, target_id: reportTarget.id, reason: reportReason, details: reportDetails.trim(), status: "pending" });
    if (error) setReportMessage(error.message);
    else { setReportTarget(null); setReportDetails(""); setMessage("신고가 접수되었습니다. 운영자가 확인하겠습니다."); }
  };

  const deletePending = async (review: Review) => {
    if (!client || !user) return;
    const { error } = await client.from("restaurant_reviews").delete().eq("id", review.id).eq("user_id", user.id);
    if (error) setMessage(error.message);
    else {
      if (review.storage_paths.length) await client.storage.from("community-review-photos").remove(review.storage_paths);
      await loadReviews();
    }
  };

  return <section className="mt-6 border-t border-[#eceee9] pt-5" aria-labelledby="community-title">
    <div className="flex items-center justify-between gap-2"><div><h3 id="community-title" className="text-[16px] font-semibold">리뷰와 사진</h3><p className="mt-1 text-[10px] text-[#929a92]">별점·평점은 수집하지 않으며, 리뷰는 관리자 확인 후 공개됩니다.</p></div><FavoriteButton restaurant={restaurant}/></div>
    {!canReview ? <p className="mt-4 rounded-xl bg-[#f4f6f1] p-3 text-[12px] leading-5 text-[#7c857c]">샘플 음식점에는 실제 후기처럼 보일 수 있는 리뷰를 등록할 수 없습니다.</p> : <>
      <form onSubmit={submitReview} className="mt-4 rounded-[16px] bg-[#f7f8f5] p-3.5">
        <label className="block text-[11px] font-medium text-[#5d665e]" htmlFor="community-review-content">방문 경험을 남겨 주세요</label>
        <textarea id="community-review-content" required minLength={5} maxLength={2000} value={content} onChange={event => setContent(event.target.value)} rows={4} placeholder="직접 경험한 내용을 작성해 주세요. 평점은 입력하지 않습니다." className="mt-2 w-full resize-y rounded-xl border border-[#e4e8e2] bg-white p-3 text-[12px] leading-5 outline-none focus:border-[#7da184]" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="community-review-photos" className="cursor-pointer rounded-full border border-[#dfe5dc] bg-white px-3 py-2 text-[11px] text-[#59695b]">사진 추가 (최대 3장)<input id="community-review-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={event => setPhotos(Array.from(event.target.files ?? []).slice(0, 3))} /></label><span className="text-[10px] text-[#929a92]">장당 5MB · JPG, PNG, WebP</span></div>
        {photos.length > 0 && <p className="mt-2 truncate text-[10px] text-[#778177]">{photos.map(file => file.name).join(" · ")}</p>}
        <div className="mt-3 flex justify-end">{user ? <button disabled={submitting} className="rounded-full bg-[#356b4a] px-4 py-2 text-[11px] font-medium text-white disabled:opacity-50">{submitting ? "등록 중…" : "검토 요청"}</button> : <button type="button" onClick={openAuth} className="rounded-full bg-[#356b4a] px-4 py-2 text-[11px] font-medium text-white">로그인하고 리뷰 쓰기</button>}</div>
      </form>
      <div className="mt-4 flex items-center justify-between"><h4 className="text-[13px] font-semibold">공개된 리뷰</h4><button onClick={() => setReportTarget({ type: "restaurant", id: key, label: restaurant.name })} className="text-[10px] text-[#838c83] underline underline-offset-2">음식점 정보 신고</button></div>
      {loading ? <p className="py-5 text-center text-[11px] text-[#8c958c]">리뷰를 불러오는 중…</p> : reviews.length ? <ul className="divide-y divide-[#edf0eb]">{reviews.map(review => <li key={review.id} className="py-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-[10px] text-[#8c958c]">{review.user_id === user?.id ? "내 리뷰" : "동네 이웃"} · {new Date(review.created_at).toLocaleDateString("ko-KR")}{review.moderation_status === "pending" && <span className="ml-2 rounded-full bg-[#fff1d8] px-2 py-0.5 text-[#8b6a32]">검토 중</span>}{review.moderation_status === "rejected" && <span className="ml-2 rounded-full bg-[#fcebea] px-2 py-0.5 text-[#a24d3f]">비공개</span>}</p><p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#485149]">{review.content}</p></div>{review.user_id === user?.id && review.moderation_status === "pending" ? <button onClick={() => void deletePending(review)} className="text-[10px] text-[#899189]">삭제</button> : review.moderation_status === "visible" && <button onClick={() => setReportTarget({ type: "review", id: review.id, label: "리뷰" })} className="text-[10px] text-[#899189]">신고</button>}</div>{review.moderation_status !== "rejected" && review.photo_urls?.length > 0 && <div className="mt-2 flex gap-2 overflow-x-auto">{review.photo_urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f0f2ed]"><Image unoptimized src={url} alt={`리뷰 사진 ${index + 1}`} fill sizes="80px" className="object-cover" /></a>)}</div>}</li>)}</ul> : <p className="py-5 text-center text-[11px] text-[#8c958c]">아직 공개된 리뷰가 없습니다.</p>}
    </>}
    {message && <p role="status" className="mt-3 rounded-xl bg-[#edf4ed] p-3 text-[11px] leading-5 text-[#456b4c]">{message}</p>}
    {reportTarget && <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setReportTarget(null); }}><form onSubmit={submitReport} className="w-full max-w-[390px] rounded-[22px] bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-[17px] font-semibold">{reportTarget.label} 신고</h3><button type="button" onClick={() => setReportTarget(null)} aria-label="닫기">×</button></div><p className="mt-1 text-[11px] text-[#879087]">검토를 위해 신고 사유를 선택해 주세요.</p><label className="mt-4 block text-[11px] text-[#5d665e]">사유<select value={reportReason} onChange={event => setReportReason(event.target.value as ReportReason)} className="mt-1.5 h-10 w-full rounded-xl border border-[#e3e8e1] bg-white px-3 text-[12px]">{reportReasons.map(reason => <option key={reason}>{reason}</option>)}</select></label><label className="mt-3 block text-[11px] text-[#5d665e]">상세 (선택)<textarea value={reportDetails} onChange={event => setReportDetails(event.target.value)} maxLength={1000} rows={3} className="mt-1.5 w-full rounded-xl border border-[#e3e8e1] p-3 text-[12px]" /></label>{reportMessage && <p role="alert" className="mt-2 text-[11px] text-[#a24d3f]">{reportMessage}</p>}<button className="mt-4 h-10 w-full rounded-full bg-[#356b4a] text-[12px] font-medium text-white">신고 접수</button></form></div>}
  </section>;
}
