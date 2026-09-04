import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NewsUpdate = {
  id?: unknown;
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  content?: unknown;
  location?: unknown;
  categoryId?: unknown;
  seoKeywords?: unknown;
  storagePath?: unknown;
};

async function getAdmin(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) return { error: NextResponse.json({ error: "Supabase Admin configuration उपलब्ध नाही." }, { status: 503 }) };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "Authentication आवश्यक आहे." }, { status: 401 }) };
  const viewer = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await viewer.auth.getUser(token);
  if (!user) return { error: NextResponse.json({ error: "Session invalid आहे." }, { status: 401 }) };
  const { data: profile } = await viewer.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "फक्त Admin बातमी पूर्ण edit करू शकतो." }, { status: 403 }) };
  return { admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), userId: user.id };
}

export async function PATCH(request: Request) {
  const context = await getAdmin(request);
  if ("error" in context) return context.error;
  const body = await request.json().catch(() => null) as NewsUpdate | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const seoKeywords = Array.isArray(body?.seoKeywords)
    ? body.seoKeywords.filter((keyword): keyword is string => typeof keyword === "string" && Boolean(keyword.trim())).map((keyword) => keyword.trim()).slice(0, 10)
    : [];
  const storagePath = typeof body?.storagePath === "string" ? body.storagePath : "";

  if (!/^[0-9a-f-]{36}$/i.test(id) || !title || !content || !/^[0-9a-f-]{36}$/i.test(categoryId)) {
    return NextResponse.json({ error: "Title, Category आणि बातमीचा पूर्ण मजकूर आवश्यक आहे." }, { status: 400 });
  }
  const { data: existing } = await context.admin.from("news").select("id, status").eq("id", id).in("status", ["submitted", "in_review", "approved"]).single();
  if (!existing) return NextResponse.json({ error: "ही प्रलंबित बातमी उपलब्ध नाही किंवा edit करता येणार नाही." }, { status: 404 });
  const { data: category } = await context.admin.from("categories").select("id").eq("id", categoryId).single();
  if (!category) return NextResponse.json({ error: "निवडलेली Category उपलब्ध नाही." }, { status: 400 });

  let featuredImageUrl: string | undefined;
  if (storagePath) {
    if (!storagePath.startsWith(`${context.userId}/${id}/`) || !/^[a-zA-Z0-9_./-]+$/.test(storagePath)) {
      return NextResponse.json({ error: "Featured Image path सुरक्षित नाही." }, { status: 400 });
    }
    featuredImageUrl = context.admin.storage.from("news-images").getPublicUrl(storagePath).data.publicUrl;
  }

  const update = {
    title,
    slug: slug || null,
    excerpt: excerpt || null,
    content,
    location: location || null,
    category_id: categoryId,
    seo_keywords: seoKeywords,
    ...(featuredImageUrl ? { featured_image_url: featuredImageUrl } : {}),
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await context.admin.from("news").update(update).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.code === "23505" ? "हा SEO Slug आधीच वापरला आहे." : updateError.message }, { status: 400 });

  if (featuredImageUrl) {
    await context.admin.from("news_images").update({ is_featured: false }).eq("news_id", id).eq("is_featured", true);
    const { error: imageError } = await context.admin.from("news_images").insert({
      news_id: id,
      storage_path: storagePath,
      public_url: featuredImageUrl,
      alt_text: title,
      is_featured: true,
    });
    if (imageError) return NextResponse.json({ success: true, featuredImageUrl, warning: "फोटो update झाला; image history record जतन झाला नाही." });
  }
  return NextResponse.json({ success: true, featuredImageUrl });
}
