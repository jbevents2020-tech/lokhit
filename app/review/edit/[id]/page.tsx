"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, LoaderCircle, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; parent_id: string | null };
type EditableNews = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  content: string;
  location: string | null;
  category_id: string | null;
  seo_keywords: string[] | null;
  featured_image_url: string | null;
};

export default function AdminNewsEditPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const newsId = params.id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const [profileResult, newsResult, categoryResult] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).single(),
        supabase.from("news").select("id, title, slug, excerpt, content, location, category_id, seo_keywords, featured_image_url").eq("id", newsId).in("status", ["submitted", "in_review", "approved"]).single(),
        supabase.from("categories").select("id, name, parent_id").order("name"),
      ]);
      if (profileResult.data?.role !== "admin") { window.location.href = "/review"; return; }
      if (newsResult.error || !newsResult.data) { setMessage("ही प्रलंबित बातमी उपलब्ध नाही किंवा edit करता येणार नाही."); setLoading(false); return; }
      const news = newsResult.data as EditableNews;
      setTitle(news.title); setSlug(news.slug ?? ""); setExcerpt(news.excerpt ?? ""); setContent(news.content);
      setLocation(news.location ?? ""); setCategoryId(news.category_id ?? ""); setSeoKeywords((news.seo_keywords ?? []).join(", "));
      setImagePreview(news.featured_image_url); setCategories((categoryResult.data ?? []) as Category[]); setLoading(false);
    }
    load();
  }, [newsId, supabase]);

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("फोटो JPG, PNG किंवा WebP आणि 5 MB पेक्षा लहान असावा."); event.target.value = ""; return;
    }
    setImage(file); setMessage(null);
    setImagePreview((current) => { if (current?.startsWith("blob:")) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    let storagePath = "";
    try {
      if (image) {
        const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
        storagePath = `${session.user.id}/${newsId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("news-images").upload(storagePath, image, { contentType: image.type, cacheControl: "3600", upsert: false });
        if (error) throw new Error(`नवीन फोटो upload झाला नाही: ${error.message}`);
      }
      const response = await fetch("/api/admin/news", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: newsId, title, slug, excerpt, content, location, categoryId, seoKeywords: seoKeywords.split(",").map((value) => value.trim()).filter(Boolean), storagePath }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "बातमी update झाली नाही.");
      router.push("/review"); router.refresh();
    } catch (error) {
      if (storagePath) await supabase.storage.from("news-images").remove([storagePath]);
      setMessage(error instanceof Error ? error.message : "बातमी update झाली नाही."); setSaving(false);
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><LoaderCircle className="mr-2 animate-spin" size={20}/> बातमी load होत आहे...</main>;
  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6"><div><div className="text-xl font-black">लोकहित <span className="text-amber-600">Newsroom</span></div><div className="text-xs text-slate-500">Admin News Edit</div></div><Link href="/review" className="text-sm font-semibold text-slate-600">Review Queue</Link></div></header><section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8"><Link href="/review" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16}/> मागे</Link><p className="mt-5 text-sm font-bold text-amber-600">ADMIN WORKSPACE</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">बातमी पूर्ण Edit करा</h1>{message && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}<form onSubmit={save} className="mt-6 grid gap-5"><div className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2"><label className="text-sm font-bold md:col-span-2">Title<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="text-sm font-bold">Category<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"><option value="">Category निवडा</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.parent_id ? `— ${category.name}` : category.name}</option>)}</select></label><label className="text-sm font-bold">Location<input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="text-sm font-bold md:col-span-2">SEO Slug<input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="text-sm font-bold md:col-span-2">SEO Keywords<input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="keyword 1, keyword 2" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="text-sm font-bold md:col-span-2">Excerpt<textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal"/></label><label className="text-sm font-bold md:col-span-2">पूर्ण बातमी<textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={14} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal leading-7"/></label></div><div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6"><div className="flex items-center gap-2 font-bold"><ImagePlus size={19}/> Featured Photo</div>{imagePreview && <div className="relative mt-4 aspect-video overflow-hidden rounded-xl bg-slate-100"><Image src={imagePreview} alt={title || "Featured image"} fill sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover"/></div>}<label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed p-4 text-center text-sm font-semibold text-slate-600 hover:border-amber-400"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} className="sr-only"/>{image ? image.name : "नवीन फोटो निवडा (कमाल 5 MB)"}</label></div><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 font-bold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={18}/> : <Save size={18}/>} बदल Save करा</button></form></section></main>;
}
