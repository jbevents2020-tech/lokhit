"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NewsStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected" | "published";
type NewsRow = { id: string; title: string; excerpt: string | null; featured_image_url: string | null; wordpress_url: string | null; status: NewsStatus; updated_at: string; author: { full_name: string | null } | null; category: { name: string } | null };
const statuses: Array<"all" | NewsStatus> = ["all", "draft", "submitted", "in_review", "approved", "rejected", "published"];
const statusStyle: Record<NewsStatus, string> = { draft: "bg-slate-100 text-slate-700", submitted: "bg-amber-50 text-amber-700", in_review: "bg-blue-50 text-blue-700", approved: "bg-emerald-50 text-emerald-700", rejected: "bg-red-50 text-red-700", published: "bg-purple-50 text-purple-700" };

export default function AllNewsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | NewsStatus>("all");

  const loadNews = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "editor"].includes(profile.role)) { window.location.href = "/"; return; }
    const { data, error: queryError } = await supabase.from("news").select("id, title, excerpt, featured_image_url, wordpress_url, status, updated_at, author:profiles!news_author_id_fkey(full_name), category:categories(name)").order("updated_at", { ascending: false });
    if (queryError) setError(`बातम्या load झाल्या नाहीत: ${queryError.message}`); else setItems((data ?? []) as unknown as NewsRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadNews(); }, [loadNews]);
  const filtered = items.filter((item) => (status === "all" || item.status === status) && (!search.trim() || `${item.title} ${item.author?.full_name || ""} ${item.category?.name || ""}`.toLocaleLowerCase("mr").includes(search.trim().toLocaleLowerCase("mr"))));

  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><div><div className="text-xl font-black">लोकहित <span className="text-amber-600">Newsroom</span></div><div className="text-xs text-slate-500">All News</div></div><Link href="/" className="text-sm font-semibold text-slate-600">Dashboard</Link></div></header><section className="mx-auto max-w-6xl px-6 py-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16}/> मागे</Link><p className="mt-5 text-sm font-semibold text-amber-600">NEWSROOM ARCHIVE</p><h1 className="mt-1 text-3xl font-black">सर्व बातम्या</h1><p className="mt-1 text-sm text-slate-500">सर्व reportersच्या बातम्या आणि publishing status पहा.</p></div><button onClick={loadNews} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold disabled:opacity-60"><RefreshCw className={loading ? "animate-spin" : ""} size={17}/> Refresh</button></div><div className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]"><label className="relative"><Search className="absolute left-3 top-3.5 text-slate-400" size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="शीर्षक, reporter किंवा category शोधा" className="w-full rounded-xl border py-3 pl-10 pr-4 outline-none focus:border-amber-500"/></label><select value={status} onChange={(e) => setStatus(e.target.value as "all" | NewsStatus)} className="rounded-xl border px-4 py-3">{statuses.map((value) => <option key={value} value={value}>{value === "all" ? "सर्व Status" : value.replace("_", " ")}</option>)}</select></div>{error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}{loading ? <div className="mt-6 flex min-h-64 items-center justify-center rounded-2xl border bg-white"><LoaderCircle className="mr-2 animate-spin" size={18}/> बातम्या load होत आहेत...</div> : filtered.length === 0 ? <div className="mt-6 rounded-2xl border bg-white p-12 text-center"><FileText className="mx-auto text-slate-400"/><h2 className="mt-3 font-bold">बातमी उपलब्ध नाही</h2></div> : <div className="mt-6 grid gap-5 md:grid-cols-2">{filtered.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">{item.featured_image_url && <div className="relative aspect-[16/8] bg-slate-100"><Image src={item.featured_image_url} alt={item.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover"/></div>}<div className="p-5"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[item.status]}`}>{item.status.replace("_", " ")}</span><span className="text-xs font-semibold text-slate-500">{item.category?.name || "Uncategorized"}</span></div><h2 className="mt-4 text-lg font-black leading-7">{item.title}</h2>{item.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.excerpt}</p>}<p className="mt-4 text-xs text-slate-400">{item.author?.full_name || "Unknown reporter"} · {new Date(item.updated_at).toLocaleDateString("mr-IN")}</p><div className="mt-4 flex gap-2">{item.wordpress_url && <a href={item.wordpress_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white"><ExternalLink size={16}/> Published Link</a>}{["submitted", "in_review", "approved"].includes(item.status) && <Link href="/review" className="rounded-xl border px-4 py-2 text-sm font-bold">Review</Link>}</div></div></article>)}</div>}</section></main>;
}

