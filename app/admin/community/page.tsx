"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useCommunity } from "../../components/CommunityProvider";

type ReviewRow = { id: string; user_id: string; restaurant_name: string; content: string; photo_urls: string[]; storage_paths: string[]; moderation_status: "pending" | "visible" | "rejected"; created_at: string };
type ReportRow = { id: string; reporter_id: string; target_type: "review" | "restaurant"; target_id: string; reason: string; details: string; status: "pending" | "reviewed" | "dismissed"; created_at: string };

export default function CommunityAdminPage() {
  const { client, user, role } = useCommunity();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!client || role !== "admin") return;
    setBusy(true);
    const [{ data: reviewData, error: reviewError }, { data: reportData, error: reportError }] = await Promise.all([
      client.from("restaurant_reviews").select("id,user_id,restaurant_name,content,photo_urls,moderation_status,created_at").order("created_at", { ascending: false }).limit(200),
      client.from("community_reports").select("id,reporter_id,target_type,target_id,reason,details,status,created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    if (reviewError || reportError) setMessage("관리 데이터를 불러오지 못했습니다. 관리자 권한과 RLS 정책을 확인해 주세요.");
    else {
      const rows = reviewData ?? [];
      const paths = rows.flatMap(row => (row.photo_urls ?? []) as string[]);
      const { data: signedPhotos } = paths.length ? await client.storage.from("community-review-photos").createSignedUrls(paths, 3600) : { data: [] };
      const signedByPath = new Map((signedPhotos ?? []).map(photo => [photo.path, photo.signedUrl]));
      setReviews(rows.map(row => {
        const storagePaths = (row.photo_urls ?? []) as string[];
        return { ...row, storage_paths: storagePaths, photo_urls: storagePaths.map(path => signedByPath.get(path) ?? "").filter(Boolean) } as ReviewRow;
      }));
      setReports((reportData ?? []) as ReportRow[]); setMessage("");
    }
    setBusy(false);
  }, [client, role]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const moderateReview = async (review: ReviewRow, status: "visible" | "rejected") => {
    if (!client || !user) return;
    const { error } = await client.from("restaurant_reviews").update({ moderation_status: status, moderated_by: user.id, moderated_at: new Date().toISOString() }).eq("id", review.id);
    if (error) setMessage(error.message); else await load();
  };

  const resolveReport = async (report: ReportRow, status: "reviewed" | "dismissed") => {
    if (!client || !user) return;
    const { error } = await client.from("community_reports").update({ status, handled_by: user.id, handled_at: new Date().toISOString() }).eq("id", report.id);
    if (error) setMessage(error.message); else await load();
  };

  if (role !== "admin") return <main className="mx-auto min-h-screen max-w-[760px] px-5 py-12"><Link href="/" className="text-[12px] text-[#477754]">← 동네식탁으로</Link><div className="mt-6 rounded-2xl bg-white p-6"><h1 className="text-xl font-semibold">커뮤니티 관리</h1><p className="mt-2 text-sm text-[#737d73]">관리자 계정으로 로그인해야 접근할 수 있습니다.</p></div></main>;

  return <main className="mx-auto min-h-screen max-w-[900px] px-5 py-8 md:px-8"><div className="flex items-center justify-between"><div><Link href="/" className="text-[12px] text-[#477754]">← 동네식탁으로</Link><h1 className="mt-2 text-2xl font-semibold">커뮤니티 관리</h1><p className="mt-1 text-[12px] text-[#7b847b]">신고를 확인하고 리뷰 공개 여부를 관리합니다.</p></div><button onClick={() => void load()} disabled={busy} className="rounded-full border border-[#e2e7e0] bg-white px-4 py-2 text-[12px]">새로고침</button></div>
    {message && <p role="alert" className="mt-4 rounded-xl bg-[#fff3ef] p-3 text-[12px] text-[#9a5143]">{message}</p>}
    <section className="mt-8"><div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold">리뷰 검토</h2><span className="text-[11px] text-[#8c958c]">대기 {reviews.filter(item => item.moderation_status === "pending").length}건</span></div>{reviews.length ? <ul className="mt-3 space-y-3">{reviews.map(review => <li key={review.id} className="rounded-2xl border border-[#e8ece6] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-[13px]">{review.restaurant_name}</strong><span className="ml-2 rounded-full bg-[#f0f2ed] px-2 py-1 text-[10px] text-[#697469]">{review.moderation_status === "pending" ? "검토 대기" : review.moderation_status === "visible" ? "공개" : "비공개"}</span></div><time className="text-[10px] text-[#919991]">{new Date(review.created_at).toLocaleString("ko-KR")}</time></div><p className="mt-3 whitespace-pre-wrap text-[12px] leading-5 text-[#4d574e]">{review.content}</p>{review.photo_urls?.length > 0 && <div className="mt-3 flex gap-2">{review.photo_urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><Image unoptimized src={url} alt={`리뷰 사진 ${index + 1}`} width={64} height={64} className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}<div className="mt-3 flex gap-2"><button onClick={() => void moderateReview(review, "visible")} className="rounded-full bg-[#356b4a] px-3 py-1.5 text-[10px] text-white">공개</button><button onClick={() => void moderateReview(review, "rejected")} className="rounded-full border border-[#e2e7e0] px-3 py-1.5 text-[10px] text-[#667066]">비공개 처리</button></div></li>)}</ul> : <p className="mt-3 rounded-xl bg-white p-5 text-[12px] text-[#8a938a]">검토할 리뷰가 없습니다.</p>}</section>
    <section className="mt-9"><div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold">신고 관리</h2><span className="text-[11px] text-[#8c958c]">대기 {reports.filter(item => item.status === "pending").length}건</span></div>{reports.length ? <ul className="mt-3 space-y-3">{reports.map(report => <li key={report.id} className="rounded-2xl border border-[#e8ece6] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[13px]">{report.target_type === "review" ? "리뷰" : "음식점 정보"} 신고 · {report.reason}</strong><span className="text-[10px] text-[#919991]">{report.status === "pending" ? "확인 대기" : report.status === "reviewed" ? "처리 완료" : "기각"} · {new Date(report.created_at).toLocaleString("ko-KR")}</span></div><p className="mt-2 break-all text-[10px] text-[#849084]">대상: {report.target_id}</p>{report.details && <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#4d574e]">{report.details}</p>}<div className="mt-3 flex gap-2"><button onClick={() => void resolveReport(report, "reviewed")} className="rounded-full bg-[#356b4a] px-3 py-1.5 text-[10px] text-white">처리 완료</button><button onClick={() => void resolveReport(report, "dismissed")} className="rounded-full border border-[#e2e7e0] px-3 py-1.5 text-[10px] text-[#667066]">기각</button></div></li>)}</ul> : <p className="mt-3 rounded-xl bg-white p-5 text-[12px] text-[#8a938a]">접수된 신고가 없습니다.</p>}</section>
  </main>;
}
