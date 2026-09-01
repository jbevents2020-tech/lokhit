"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink, FileText, ImagePlus, LayoutDashboard, LogOut, PenLine, Send, Share2, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  role: "admin" | "editor" | "reporter";
};

type DashboardStats = {
  total: number;
  pending: number;
  published: number;
  reporters: number;
  draft: number;
  submitted: number;
};

type PublishedNews = {
  id: string;
  title: string;
  wordpress_url: string;
  featured_image_url: string | null;
  published_at: string | null;
};

const emptyStats: DashboardStats = {
  total: 0,
  pending: 0,
  published: 0,
  reporters: 0,
  draft: 0,
  submitted: 0,
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [publishedNews, setPublishedNews] = useState<PublishedNews[]>([]);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const [profileResult, totalResult, pendingResult, publishedResult, reportersResult, draftResult, submittedResult, publishedNewsResult] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
        supabase.from("news").select("id", { count: "exact", head: true }),
        supabase.from("news").select("id", { count: "exact", head: true }).in("status", ["submitted", "in_review", "approved"]),
        supabase.from("news").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "reporter").eq("is_active", true),
        supabase.from("news").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("news").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("news").select("id, title, wordpress_url, featured_image_url, published_at").eq("status", "published").not("wordpress_url", "is", null).order("published_at", { ascending: false }).limit(10),
      ]);

      if (profileResult.data) setProfile(profileResult.data as Profile);

      setStats({
        total: totalResult.count ?? 0,
        pending: pendingResult.count ?? 0,
        published: publishedResult.count ?? 0,
        reporters: reportersResult.count ?? 0,
        draft: draftResult.count ?? 0,
        submitted: submittedResult.count ?? 0,
      });
      setPublishedNews((publishedNewsResult.data ?? []) as PublishedNews[]);
      setLoading(false);
    }

    loadDashboard();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function sharePublished(item: PublishedNews) {
    setShareNotice(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: item.title, url: item.wordpress_url });
        return;
      }
      await navigator.clipboard.writeText(item.wordpress_url);
      setShareNotice("बातमीची link clipboardमध्ये copy झाली.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareNotice("Link share करता आली नाही. Open buttonमधून link copy करा.");
    }
  }

  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "User";
  const avatarLetter = profile?.full_name?.trim()?.charAt(0)?.toUpperCase() || "U";

  const cards = [
    ["एकूण बातम्या", stats.total, "Live database"],
    ["प्रलंबित", stats.pending, "Editor review"],
    ["प्रकाशित", stats.published, "Published"],
    ["Reporters", stats.reporters, "Active users"],
  ] as const;

  const workflow = [
    { label: "Draft", count: stats.draft, icon: PenLine },
    { label: "Submitted", count: stats.submitted, icon: Send },
    { label: "Published", count: stats.published, icon: FileText },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-2xl font-black tracking-tight">लोकहित <span className="text-amber-600">Newsroom</span></div>
            <div className="text-xs text-slate-500">Digital News Publishing Platform</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{roleLabel}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{avatarLetter}</div>
            <button onClick={handleLogout} title="Logout" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-950"><LogOut size={17}/></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r bg-white p-4 md:block">
          <nav className="space-y-1 text-sm">
            <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"><LayoutDashboard size={17}/> Dashboard</div>
            <Link href="/news" className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-50"><PenLine size={17}/> नवीन बातमी</Link>
            <Link href="/my-news" className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-50"><FileText size={17}/> माझ्या बातम्या</Link>
            {(profile?.role === "admin" || profile?.role === "editor") && <Link href="/review" className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-50"><Send size={17}/> Editor Review</Link>}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600"><FileText size={17}/> सर्व बातम्या</div>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600"><Users size={17}/> Reporters</div>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600"><Sparkles size={17}/> Gemini AI</div>
          </nav>
        </aside>

        <section className="p-6 md:p-8">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold text-amber-600">WELCOME</p><h1 className="mt-1 text-3xl font-black">Newsroom Dashboard</h1><p className="mt-1 text-sm text-slate-500">{profile?.full_name || "Newsroom User"} यांचा live newsroom आढावा</p></div>
            <Link href="/news" className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-sm"><PenLine size={17}/> नवीन बातमी तयार करा</Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([title, value, note]) => <div key={title} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-black">{loading ? "…" : value}</p><p className="mt-1 text-xs font-medium text-emerald-600">{note}</p></div>)}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between"><div><h2 className="font-bold">Publishing Workflow</h2><p className="text-sm text-slate-500">बातमी कोणत्या stage वर आहे</p></div><Sparkles className="text-amber-600" size={20}/></div>
              <div className="mt-6 space-y-4">{workflow.map(({label,count,icon:Icon}) => <div key={label} className="flex items-center gap-4"><div className="rounded-xl bg-slate-100 p-3"><Icon size={18}/></div><div className="flex-1"><div className="flex justify-between text-sm font-semibold"><span>{label}</span><span>{loading ? "…" : count}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-amber-500" style={{width:`${Math.min(count,100)}%`}} /></div></div></div>)}</div>
            </div>
            <div className="rounded-2xl border bg-slate-900 p-6 text-white shadow-sm">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-white/10 p-3"><Sparkles size={20}/></div><div><h2 className="font-bold">Gemini AI</h2><p className="text-xs text-slate-300">News writing assistant</p></div></div>
              <p className="mt-6 text-sm leading-6 text-slate-300">कच्ची माहिती द्या. AI headline, बातमी, excerpt, SEO slug आणि tags तयार करण्यास मदत करेल.</p>
              <button className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900">AI News Generator उघडा</button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4"><div><h2 className="font-bold">Published News</h2><p className="text-sm text-slate-500">WordPressवर प्रकाशित बातम्या उघडा किंवा share करा.</p></div><span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{loading ? "…" : publishedNews.length}</span></div>
            {shareNotice && <div role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{shareNotice}</div>}
            {!loading && publishedNews.length === 0 ? <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">अजून WordPressवर प्रकाशित बातमी उपलब्ध नाही.</div> : <div className="mt-5 divide-y">{publishedNews.map((item) => <article key={item.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">{item.featured_image_url ? <div className="relative h-20 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-32"><Image src={item.featured_image_url} alt={item.title} fill sizes="(max-width: 640px) 100vw, 128px" className="object-cover"/></div> : <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 sm:w-32"><FileText size={24}/></div>}<div className="min-w-0 flex-1"><h3 className="font-bold leading-6">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{item.published_at ? new Date(item.published_at).toLocaleDateString("mr-IN") : "Published"}</p></div><div className="flex shrink-0 gap-2"><a href={item.wordpress_url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 sm:flex-none"><ExternalLink size={16}/> Open</a><button type="button" onClick={() => sharePublished(item)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white sm:flex-none"><Share2 size={16}/> Share</button></div></article>)}</div>}
          </div>

          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><ImagePlus size={20} className="text-amber-600"/><div><h2 className="font-bold">Live Supabase Dashboard</h2><p className="text-sm text-slate-500">Dashboard counts आता Supabase मधील actual profiles आणि news records वर आधारित आहेत.</p></div></div></div>
        </section>
      </div>
    </main>
  );
}

