"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Clock3, LoaderCircle, RefreshCw, Send, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = { full_name: string | null; role: "admin" | "editor" | "reporter" };
type ReviewItem = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  location: string | null;
  featured_image_url: string | null;
  status: "submitted" | "in_review" | "approved";
  created_at: string;
  author: { full_name: string | null } | null;
  category: { name: string } | null;
};

export default function ReviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectionId, setRejectionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news")
      .select("id, title, excerpt, content, location, featured_image_url, status, created_at, author:profiles!news_author_id_fkey(full_name), category:categories(name)")
      .in("status", ["submitted", "in_review", "approved"])
      .order("created_at", { ascending: true });
    if (error) setNotice({ type: "error", text: `Review queue load झाली नाही: ${error.message}` });
    else setItems((data ?? []) as unknown as ReviewItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data, error } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
      if (error || !data) { setNotice({ type: "error", text: `Profile verify झाला नाही: ${error?.message ?? "Profile missing"}` }); setLoading(false); return; }
      const currentProfile = data as Profile;
      if (currentProfile.role !== "admin" && currentProfile.role !== "editor") { window.location.href = "/"; return; }
      setUserId(user.id);
      setProfile(currentProfile);
      await loadQueue();
    }
    initialize();
  }, [loadQueue, supabase]);

  async function approve(item: ReviewItem) {
    if (!userId) return;
    setWorkingId(item.id);
    setNotice(null);
    const { error } = await supabase.from("news").update({ status: "approved", editor_id: userId, rejection_reason: null, updated_at: new Date().toISOString() }).eq("id", item.id).in("status", ["submitted", "in_review"]);
    if (error) setNotice({ type: "error", text: `Approve झाले नाही: ${error.message}` });
    else { setItems((current) => current.map((news) => news.id === item.id ? { ...news, status: "approved" } : news)); setNotice({ type: "success", text: `“${item.title}” approve झाली. आता WordPress वर publish करू शकता.` }); }
    setWorkingId(null);
  }

  async function publish(item: ReviewItem) {
    setWorkingId(item.id);
    setNotice(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    try {
      const response = await fetch("/api/wordpress/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ newsId: item.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Publishing अयशस्वी झाले.");
      setItems((current) => current.filter((news) => news.id !== item.id));
      setNotice({ type: "success", text: `“${item.title}” WordPress वर publish झाली: ${result.wordpressUrl}` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Publishing अयशस्वी झाले." });
    }
    setWorkingId(null);
  }

  async function reject(item: ReviewItem) {
    if (!userId || !rejectionReason.trim()) { setNotice({ type: "error", text: "Reject करण्यासाठी कारण लिहा." }); return; }
    setWorkingId(item.id);
    setNotice(null);
    const { error } = await supabase.from("news").update({ status: "rejected", editor_id: userId, rejection_reason: rejectionReason.trim(), updated_at: new Date().toISOString() }).eq("id", item.id).in("status", ["submitted", "in_review"]);
    if (error) setNotice({ type: "error", text: `Reject झाले नाही: ${error.message}` });
    else { setItems((current) => current.filter((news) => news.id !== item.id)); setRejectionId(null); setRejectionReason(""); setNotice({ type: "success", text: `“${item.title}” reporter कडे परत पाठवली.` }); }
    setWorkingId(null);
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><div><div className="text-xl font-black">लोकहित <span className="text-amber-600">Newsroom</span></div><div className="text-xs text-slate-500">Editor Review</div></div><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-slate-500 sm:inline">{profile?.full_name} · {profile?.role}</span><Link href="/" className="text-sm font-semibold text-slate-600">Dashboard</Link></div></div></header>
    <section className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16}/> मागे</Link><p className="mt-5 text-sm font-semibold text-amber-600">EDITOR WORKSPACE</p><h1 className="mt-1 text-3xl font-black">Review Queue</h1><p className="mt-1 text-sm text-slate-500">Submitted बातम्या तपासा, approve करा किंवा कारणासह reporter कडे परत पाठवा.</p></div><button onClick={loadQueue} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-60"><RefreshCw className={loading ? "animate-spin" : ""} size={17}/> Refresh</button></div>
      {notice && <div role="status" className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</div>}
      {loading ? <div className="mt-8 flex min-h-64 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/> Review queue load होत आहे...</div> : items.length === 0 ? <div className="mt-8 rounded-2xl border bg-white p-12 text-center shadow-sm"><CheckCircle2 className="mx-auto text-emerald-500" size={34}/><h2 className="mt-4 text-lg font-bold">Review queue रिकामी आहे</h2><p className="mt-1 text-sm text-slate-500">नवीन submitted बातम्या येथे दिसतील.</p></div> : <div className="mt-8 space-y-5">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">{item.featured_image_url && <div className="relative aspect-[16/7] bg-slate-100"><Image src={item.featured_image_url} alt={item.title} fill sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover"/></div>}<div className="p-6"><div className="flex flex-col justify-between gap-4 md:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className={`rounded-full px-3 py-1 ${item.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><Clock3 className="mr-1 inline" size={13}/>{item.status}</span>{item.category && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{item.category.name}</span>}</div><h2 className="mt-3 text-xl font-black">{item.title}</h2><p className="mt-1 text-xs text-slate-500">{item.author?.full_name || "Unknown reporter"}{item.location ? ` · ${item.location}` : ""} · {new Date(item.created_at).toLocaleDateString("mr-IN")}</p></div><div className="flex shrink-0 gap-2">{item.status === "approved" ? <button onClick={() => publish(item)} disabled={workingId !== null} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{workingId === item.id ? <LoaderCircle className="animate-spin" size={16}/> : <Send size={16}/>} WordPress वर Publish</button> : <><button onClick={() => approve(item)} disabled={workingId !== null} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 size={16}/> Approve</button><button onClick={() => { setRejectionId(item.id); setRejectionReason(""); }} disabled={workingId !== null} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-60"><XCircle size={16}/> Reject</button></>}</div></div>{item.excerpt && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700">{item.excerpt}</p>}<div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.content}</div>{rejectionId === item.id && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4"><label className="text-sm font-bold text-red-800">Rejection reason<textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} placeholder="Reporter ने कोणते बदल करावेत?" className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 font-normal text-slate-900 outline-none focus:border-red-400" /></label><div className="mt-3 flex gap-2"><button onClick={() => reject(item)} disabled={workingId === item.id} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{workingId === item.id ? "Reject होत आहे..." : "Confirm Reject"}</button><button onClick={() => setRejectionId(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600">Cancel</button></div></div>}</div></article>)}</div>}
    </section>
  </main>;
}

