"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, LoaderCircle, PenLine, Plus, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NewsStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected" | "published";
type NewsItem = { id: string; title: string; excerpt: string | null; status: NewsStatus; rejection_reason: string | null; created_at: string; updated_at: string; category: { name: string } | null };

const statusStyles: Record<NewsStatus, string> = {
  draft: "bg-slate-100 text-slate-700", submitted: "bg-amber-50 text-amber-700", in_review: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700", rejected: "bg-red-50 text-red-700", published: "bg-purple-50 text-purple-700",
};

export default function MyNewsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async (authorId: string) => {
    setLoading(true); setError(null);
    const { data, error: queryError } = await supabase.from("news").select("id, title, excerpt, status, rejection_reason, created_at, updated_at, category:categories(name)").eq("author_id", authorId).order("updated_at", { ascending: false });
    if (queryError) setError(`बातम्या load झाल्या नाहीत: ${queryError.message}`);
    else setItems((data ?? []) as unknown as NewsItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUserId(user.id); await loadNews(user.id);
    }
    initialize();
  }, [loadNews, supabase]);

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><div><div className="text-xl font-black">लोकहित <span className="text-amber-600">Newsroom</span></div><div className="text-xs text-slate-500">My News</div></div><Link href="/" className="text-sm font-semibold text-slate-600">Dashboard</Link></div></header>
    <section className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16}/> मागे</Link><p className="mt-5 text-sm font-semibold text-amber-600">REPORTER WORKSPACE</p><h1 className="mt-1 text-3xl font-black">माझ्या बातम्या</h1><p className="mt-1 text-sm text-slate-500">तुमच्या सर्व बातम्यांची status आणि editor feedback पहा.</p></div><div className="flex gap-2"><button onClick={() => userId && loadNews(userId)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold disabled:opacity-60"><RefreshCw className={loading ? "animate-spin" : ""} size={16}/> Refresh</button><Link href="/news" className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white"><Plus size={17}/> नवीन बातमी</Link></div></div>
      {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {loading ? <div className="mt-8 flex min-h-64 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/> बातम्या load होत आहेत...</div> : items.length === 0 ? <div className="mt-8 rounded-2xl border bg-white p-12 text-center shadow-sm"><FileText className="mx-auto text-slate-400" size={34}/><h2 className="mt-4 text-lg font-bold">अजून बातम्या नाहीत</h2><Link href="/news" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white"><Plus size={17}/> पहिली बातमी तयार करा</Link></div> : <div className="mt-8 grid gap-5 md:grid-cols-2">{items.map((item) => { const editable = item.status === "draft" || item.status === "rejected"; return <article key={item.id} className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[item.status]}`}>{item.status.replace("_", " ")}</span>{item.category && <span className="text-xs font-semibold text-slate-500">{item.category.name}</span>}</div><h2 className="mt-4 text-lg font-black">{item.title}</h2>{item.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.excerpt}</p>}<p className="mt-4 text-xs text-slate-400">Updated {new Date(item.updated_at).toLocaleDateString("mr-IN")}</p>{item.rejection_reason && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"><strong>Editor feedback:</strong> {item.rejection_reason}</div>}{editable && <Link href={`/news?id=${item.id}`} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"><PenLine size={16}/> Edit आणि Resubmit</Link>}</article>; })}</div>}
    </section>
  </main>;
}

