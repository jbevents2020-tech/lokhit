"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ImagePlus, LoaderCircle, Send, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = { full_name: string | null; role: "admin" | "editor" | "reporter" };
type Category = { id: string; name: string; parent_id: string | null };
type SaveStatus = "draft" | "submitted";

function makeSlug(value: string) {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

export default function NewsCreatorPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<SaveStatus | null>(null);
  const [savedNewsId, setSavedNewsId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [rawInfo, setRawInfo] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadCreator() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      setUserId(user.id);
      const editId = new URLSearchParams(window.location.search).get("id");
      const [profileResult, categoriesResult, newsResult] = await Promise.all([
        supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
        supabase.from("categories").select("id, name, parent_id").order("name"),
        editId ? supabase.from("news").select("id, title, slug, excerpt, content, seo_keywords, location, category_id, status, rejection_reason, featured_image_url").eq("id", editId).eq("author_id", user.id).in("status", ["draft", "rejected"]).single() : Promise.resolve({ data: null, error: null }),
      ]);

      if (profileResult.error) setMessage({ type: "error", text: `Profile load झाला नाही: ${profileResult.error.message}` });
      else setProfile(profileResult.data as Profile);
      if (categoriesResult.error) setMessage({ type: "error", text: `Categories load झाल्या नाहीत: ${categoriesResult.error.message}` });
      else setCategories((categoriesResult.data ?? []) as Category[]);
      if (editId && newsResult.error) setMessage({ type: "error", text: "ही बातमी edit करता येत नाही किंवा ती उपलब्ध नाही." });
      else if (newsResult.data) {
        setSavedNewsId(newsResult.data.id); setTitle(newsResult.data.title); setSlug(newsResult.data.slug ?? "");
        setExcerpt(newsResult.data.excerpt ?? ""); setContent(newsResult.data.content); setSeoKeywords((newsResult.data.seo_keywords ?? []).join(", ")); setLocation(newsResult.data.location ?? "");
        setCategoryId(newsResult.data.category_id ?? ""); setRejectionReason(newsResult.data.rejection_reason);
        setFeaturedImagePreview(newsResult.data.featured_image_url ?? null);
      }
      setPageLoading(false);
    }
    loadCreator();
  }, [supabase]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slug || slug === makeSlug(title)) setSlug(makeSlug(value));
  }

  function handleFeaturedImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ type: "error", text: "फक्त JPG, PNG किंवा WebP image निवडा." });
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Featured Image 5 MB पेक्षा लहान असणे आवश्यक आहे." });
      event.target.value = "";
      return;
    }
    setMessage(null);
    setFeaturedImage(file);
    setFeaturedImagePreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  async function uploadFeaturedImage(newsId: string) {
    if (!featuredImage || !userId) return null;
    const extension = featuredImage.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${userId}/${newsId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("news-images").upload(storagePath, featuredImage, {
      cacheControl: "3600", contentType: featuredImage.type, upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabase.storage.from("news-images").getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;
    const { error: oldImageError } = await supabase.from("news_images").update({ is_featured: false }).eq("news_id", newsId).eq("is_featured", true);
    if (oldImageError) {
      await supabase.storage.from("news-images").remove([storagePath]);
      throw new Error(oldImageError.message);
    }
    const { error: imageRowError } = await supabase.from("news_images").insert({
      news_id: newsId, storage_path: storagePath, public_url: publicUrl,
      alt_text: title.trim() || null, is_featured: true,
    });
    if (imageRowError) {
      await supabase.storage.from("news-images").remove([storagePath]);
      throw new Error(imageRowError.message);
    }
    const { error: newsImageError } = await supabase.from("news").update({ featured_image_url: publicUrl }).eq("id", newsId);
    if (newsImageError) throw new Error(newsImageError.message);
    return publicUrl;
  }

  async function saveNews(event: FormEvent, status: SaveStatus) {
    event.preventDefault();
    setMessage(null);
    if (!userId) { setMessage({ type: "error", text: "Session उपलब्ध नाही. कृपया पुन्हा login करा." }); return; }
    if (!title.trim()) { setMessage({ type: "error", text: "बातमीचे शीर्षक आवश्यक आहे." }); return; }
    if (status === "submitted" && !content.trim()) { setMessage({ type: "error", text: "Editor कडे submit करण्यापूर्वी बातमीचा मजकूर लिहा." }); return; }
    if (status === "submitted" && !featuredImage && !featuredImagePreview) { setMessage({ type: "error", text: "Editor कडे submit करण्यापूर्वी Featured Image upload करा." }); return; }

    setSavingAs(status);
    const newsRecord = {
      title: title.trim(), slug: slug.trim() || null, excerpt: excerpt.trim() || null,
      content: content.trim(), seo_keywords: seoKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean), location: location.trim() || null, category_id: categoryId || null,
      author_id: userId, status: featuredImage ? "draft" : status, updated_at: new Date().toISOString(),
    };
    const result = savedNewsId
      ? await supabase.from("news").update(newsRecord).eq("id", savedNewsId).select("id").single()
      : await supabase.from("news").insert(newsRecord).select("id").single();

    if (result.error) {
      setMessage({ type: "error", text: result.error.code === "23505" ? "हा slug आधीच वापरला आहे. कृपया वेगळा slug द्या." : `बातमी जतन झाली नाही: ${result.error.message}` });
    } else {
      const newsId = result.data.id;
      setSavedNewsId(newsId);
      try {
        const publicUrl = await uploadFeaturedImage(newsId);
        if (publicUrl) {
          setFeaturedImage(null);
          setFeaturedImagePreview(publicUrl);
        }
        if (featuredImage && status === "submitted") {
          const { error: submitError } = await supabase.from("news").update({ status: "submitted", updated_at: new Date().toISOString() }).eq("id", newsId);
          if (submitError) throw new Error(submitError.message);
        }
        setSubmitted(status === "submitted");
        setMessage({ type: "success", text: status === "draft" ? "बातमी Draft म्हणून जतन झाली." : "बातमी Editor कडे यशस्वीरित्या submit झाली." });
      } catch (error) {
        setMessage({ type: "error", text: `बातमी Draft म्हणून जतन झाली, पण Featured Image upload झाला नाही: ${error instanceof Error ? error.message : "Unknown error"}` });
      }
    }
    setSavingAs(null);
  }

  async function generateWithAi() {
    setMessage(null);
    if (rawInfo.trim().length < 20) { setMessage({ type: "error", text: "AI साठी किमान 20 अक्षरांची raw माहिती द्या." }); return; }
    setAiLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    try {
      const response = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ rawInfo }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI request अयशस्वी झाली.");
      setTitle(result.article.title); setExcerpt(result.article.excerpt); setContent(result.article.content); setSlug(makeSlug(result.article.slug || result.article.title)); setSeoKeywords((result.article.seoKeywords ?? []).join(", "));
      setMessage({ type: "success", text: "Internet संदर्भ तपासून Gemini ने सविस्तर बातमी आणि SEO Keywords तयार केले. कृपया तपासून Draft जतन करा किंवा submit करा." });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "AI request अयशस्वी झाली." }); }
    setAiLoading(false);
  }

  const disabled = savingAs !== null || submitted;
  const parentCategories = categories.filter((category) => !category.parent_id);
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div><div className="text-xl font-black">लोकहित <span className="text-amber-600">Newsroom</span></div><div className="text-xs text-slate-500">News Creator</div></div>
        <div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-slate-500 sm:inline">{profile?.full_name || "Newsroom User"} · {profile?.role || "user"}</span><Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Dashboard</Link></div>
      </div></header>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16}/> मागे</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-amber-600">REPORTER WORKSPACE</p><h1 className="mt-1 text-3xl font-black">{savedNewsId ? "बातमी edit करा" : "नवीन बातमी तयार करा"}</h1><p className="mt-1 text-sm text-slate-500">बातमी लिहा, AI मदत घ्या आणि editor कडे submit करा.</p></div><button type="button" onClick={() => document.getElementById("ai-notes")?.focus()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"><Sparkles size={17}/> Gemini AI</button></div>
        {pageLoading ? <div className="mt-8 flex min-h-64 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/> News Creator load होत आहे...</div> :
        <form onSubmit={(event) => saveNews(event, "submitted")} className="mt-8 grid gap-6 lg:grid-cols-[1fr_330px]">
          <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            {rejectionReason && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><strong>Editor feedback:</strong> {rejectionReason}</div>}
            {message && <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.type === "success" && <CheckCircle2 className="mr-2 inline" size={17}/>} {message.text}</div>}
            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2"><span className="mb-2 block text-sm font-semibold">बातमीचे शीर्षक</span><input value={title} onChange={(e) => handleTitleChange(e.target.value)} disabled={disabled} placeholder="उदा. जिल्ह्यातील महत्त्वाची बातमी..." className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 disabled:bg-slate-50" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Category</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={disabled} className="w-full rounded-xl border border-slate-200 px-4 py-3 disabled:bg-slate-50"><option value="">निवडा</option>{parentCategories.map((parent) => { const children = categories.filter((category) => category.parent_id === parent.id); return children.length ? <optgroup key={parent.id} label={parent.name}><option value={parent.id}>{parent.name} — सर्व</option>{children.map((child) => <option key={child.id} value={child.id}>↳ {child.name}</option>)}</optgroup> : <option key={parent.id} value={parent.id}>{parent.name}</option>; })}</select></label>
              <label><span className="mb-2 block text-sm font-semibold">Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} disabled={disabled} placeholder="शहर / तालुका / जिल्हा" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 disabled:bg-slate-50" /></label>
              <label><span className="mb-2 block text-sm font-semibold">SEO Slug</span><input value={slug} onChange={(e) => setSlug(makeSlug(e.target.value))} disabled={disabled} placeholder="news-headline" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 disabled:bg-slate-50" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Author</span><input value={profile?.full_name || "Newsroom User"} disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500" /></label>
              <label className="md:col-span-2"><span className="mb-2 block text-sm font-semibold">Excerpt</span><textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} disabled={disabled} rows={3} placeholder="बातमीचा संक्षिप्त सारांश..." className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 disabled:bg-slate-50" /></label>
              <label className="md:col-span-2"><span className="mb-2 block text-sm font-semibold">SEO Keywords</span><textarea value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} disabled={disabled} rows={2} placeholder="AI तयार केलेले keywords comma ने वेगळे दिसतील" className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 disabled:bg-slate-50" /></label>
              <label className="md:col-span-2"><span className="mb-2 block text-sm font-semibold">बातमीचा मजकूर</span><textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={disabled} rows={12} placeholder="बातमीची संपूर्ण माहिती येथे लिहा..." className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500 disabled:bg-slate-50" /></label>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={(e) => saveNews(e, "draft")} disabled={disabled} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold disabled:opacity-60">{savingAs === "draft" ? "जतन होत आहे..." : savedNewsId ? "Draft अपडेट करा" : "Draft जतन करा"}</button>
              <button type="submit" disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{savingAs === "submitted" ? <><LoaderCircle className="animate-spin" size={17}/> Submit होत आहे...</> : <><Send size={17}/> Editor कडे Submit करा</>}</button>
              {submitted && <Link href="/" className="rounded-xl border border-slate-200 px-5 py-3 text-center text-sm font-bold">Dashboard वर जा</Link>}
            </div>
          </div>
          <aside className="space-y-6">
            <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><ImagePlus size={20}/></div><div><h2 className="font-bold">Featured Image</h2><p className="text-xs text-slate-500">मुख्य फोटो upload करा</p></div></div><label htmlFor="featured-image" className={`relative mt-5 flex min-h-44 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500 transition hover:border-amber-400 hover:bg-amber-50 ${disabled ? "pointer-events-none opacity-60" : ""}`} style={featuredImagePreview ? { backgroundImage: `linear-gradient(rgb(15 23 42 / 0.28), rgb(15 23 42 / 0.28)), url(${featuredImagePreview})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}><input id="featured-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFeaturedImage} disabled={disabled} className="sr-only"/><span className={`rounded-lg px-4 py-2 font-semibold ${featuredImagePreview ? "bg-white/90 text-slate-900 shadow" : ""}`}>{featuredImagePreview ? "फोटो बदलण्यासाठी क्लिक करा" : "फोटो निवडण्यासाठी क्लिक करा"}</span></label><p className="mt-2 text-center text-xs text-slate-400">JPG, PNG किंवा WebP · कमाल 5 MB</p></div>
            <div className="rounded-2xl bg-slate-900 p-5 text-white"><h2 className="font-bold">AI Assistant</h2><p className="mt-2 text-sm leading-6 text-slate-300">Raw information वरून headline, article, excerpt आणि SEO slug तयार करा.</p><textarea id="ai-notes" value={rawInfo} onChange={(event) => setRawInfo(event.target.value)} disabled={aiLoading || submitted} rows={7} placeholder="घटनेची तथ्ये, नावे, ठिकाण, वेळ आणि quotes येथे द्या..." className="mt-4 w-full resize-y rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-amber-400 disabled:opacity-60"/><button type="button" onClick={generateWithAi} disabled={aiLoading || submitted} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-60">{aiLoading ? <><LoaderCircle className="animate-spin" size={17}/> AI बातमी तयार करत आहे...</> : "AI ने बातमी तयार करा"}</button></div>
          </aside>
        </form>}
      </section>
    </main>
  );
}

