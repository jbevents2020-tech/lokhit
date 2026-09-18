"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { digestMessages, indiaDay, safeArticleLink, type DigestArticle } from "@/lib/daily-digest";

export default function DailyDigest() {
  const supabase = useMemo(() => createClient(), []);
  const [articles, setArticles] = useState<DigestArticle[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [highlights, setHighlights] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setNotice(""); setArticles([]); setSelected([]);
      const day = indiaDay(); setDate(day.date);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { window.location.href = "/login"; return; }
        const all: DigestArticle[] = [];
        for (let offset = 0; ; offset += 200) {
          const { data, error: queryError } = await supabase.from("news")
            .select("id,title,excerpt,content,wordpress_url")
            .eq("status", "published").not("wordpress_url", "is", null)
            .gte("published_at", day.start).lt("published_at", day.end)
            .order("published_at", { ascending: false }).order("id", { ascending: true }).range(offset, offset + 199);
          if (queryError) throw queryError;
          if (cancelled) return;
          all.push(...(data as DigestArticle[] ?? []));
          if (!data || data.length < 200) break;
        }
        const valid = all.filter((item) => safeArticleLink(item.wordpress_url));
        if (!cancelled) { setArticles(valid); setSelected(valid.map((item) => item.id)); }
      } catch { if (!cancelled) setError("बातम्या आणता आल्या नाहीत. कृपया पुन्हा प्रयत्न करा."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [supabase, refresh]);

  const chosen = selected.flatMap((id) => { const item = articles.find((article) => article.id === id); return item ? [item] : []; });
  const messages = date ? digestMessages(chosen, date, highlights) : [];
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function move(index: number, offset: number) {
    setSelected((current) => { const next = [...current]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; });
  }
  async function copy(message: string) {
    try { await navigator.clipboard.writeText(message); setNotice("संदेश कॉपी झाला. WhatsApp मध्ये पेस्ट करा."); }
    catch { setNotice("कॉपी करता आली नाही. खालील संदेश निवडून कॉपी करा."); }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-5xl">
    <Link href="/" className="text-sm font-semibold text-slate-600">← Dashboard</Link>
    <div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div>
      <p className="font-bold text-emerald-700">लोकहित • WhatsApp</p><h1 className="mt-1 text-3xl font-black">आजचा बातमी आढावा</h1>
      <p className="mt-2 text-sm text-slate-600">{date} · भारतीय वेळेनुसार आज प्रकाशित झालेल्या, तुम्हाला उपलब्ध असलेल्या बातम्या.</p>
      <p className="mt-1 text-sm text-slate-600">बातम्या निवडा, क्रम ठरवा आणि शीर्षक, सारांश व लिंक एकत्र शेअर करा.</p>
    </div><button onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="rounded-xl border bg-white px-4 py-3 font-bold disabled:opacity-50">पुन्हा लोड करा</button></div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p role="status" className="mt-8">बातम्या आणत आहोत…</p> : !error && <>
      {articles.length === 0 ? <div className="mt-8 rounded-2xl border bg-white p-8 text-center">आज प्रकाशित झालेली बातमी उपलब्ध नाही.</div> : <>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">बातम्या निवडा ({selected.length}/{articles.length})</h2>
          <div className="my-4 flex flex-wrap gap-3 text-sm font-semibold">
            <button className="rounded-lg border px-3 py-2" onClick={() => { setSelected(articles.map((item) => item.id)); setHighlights(false); }}>सर्व बातम्या</button>
            <button className="rounded-lg border px-3 py-2" onClick={() => { setSelected(articles.slice(0, 7).map((item) => item.id)); setHighlights(true); }}>ताज्या ७ निवडा</button>
            <button className="rounded-lg border px-3 py-2" onClick={() => setSelected([])}>निवड रद्द करा</button>
          </div>
          <div className="max-h-96 divide-y overflow-y-auto">{articles.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 py-3"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"/><span>{item.title}</span></label>)}</div>
        </section>
        {chosen.length > 0 && <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">संदेशातील क्रम</h2>
          <ol className="mt-3 divide-y">{chosen.map((item, index) => <li key={item.id} className="flex items-center gap-3 py-3"><span className="min-w-0 flex-1">{index + 1}. {item.title}</span><button aria-label={`${item.title} वर हलवा`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">↑</button><button aria-label={`${item.title} खाली हलवा`} disabled={index === chosen.length - 1} onClick={() => move(index, 1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">↓</button></li>)}</ol>
          <label className="mt-4 block text-sm font-bold">संदेशाचे शीर्षक<select value={highlights ? "highlights" : "all"} onChange={(event) => setHighlights(event.target.value === "highlights")} className="ml-3 rounded-lg border p-2 font-normal"><option value="all">आजचा बातमी आढावा</option><option value="highlights">आजच्या ठळक बातम्या</option></select></label>
        </section>}
        <div role="status" aria-live="polite" className="mt-4 text-sm font-semibold text-emerald-700">{notice}</div>
        {selected.length === 0 && <p className="mt-6">संदेश तयार करण्यासाठी किमान एक बातमी निवडा.</p>}
        {messages.length > 1 && <p className="mt-6 text-sm text-slate-600">मोठा संदेश {messages.length} भागांत विभागला आहे. प्रत्येक भाग स्वतंत्रपणे शेअर करा.</p>}
        {messages.map((message, index) => <section key={index} className="mt-5 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">संदेशाचा आढावा{messages.length > 1 ? ` — भाग ${index + 1}/${messages.length}` : ""}</h2>
          <textarea aria-label={`संदेश भाग ${index + 1}`} readOnly value={message} rows={Math.min(18, message.split("\n").length + 1)} className="mt-4 w-full rounded-xl border bg-slate-50 p-4 text-sm leading-7"/>
          <div className="mt-4 flex flex-wrap gap-3">{encodeURIComponent(message).length < 8000 && <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">WhatsApp वर शेअर करा</a>}<button onClick={() => copy(message)} className="rounded-xl border px-5 py-3 text-sm font-bold">संदेश कॉपी करा</button></div>
          <p className="mt-3 text-xs text-slate-500">WhatsApp मध्ये संपर्क किंवा ग्रुप निवडून तुम्ही संदेश पाठवाल.</p>
        </section>)}
      </>}
    </>}
  </div></main>;
}
