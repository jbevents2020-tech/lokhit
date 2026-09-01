import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function textToHtml(value: string) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`).join("\n");
}

async function wordpressRequest(url: string, authorization: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { Authorization: authorization, ...init.headers }, signal: AbortSignal.timeout(45000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `WordPress request failed (${response.status}).`);
  return payload;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const wordpressUrl = process.env.WORDPRESS_URL?.replace(/\/$/, "");
  const wordpressUsername = process.env.WORDPRESS_USERNAME;
  const wordpressPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Supabase configuration उपलब्ध नाही." }, { status: 503 });
  if (!wordpressUrl || !wordpressUsername || !wordpressPassword) return NextResponse.json({ error: "WordPress publishing अजून configure केलेले नाही." }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Authentication आवश्यक आहे." }, { status: 401 });
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Session invalid आहे. पुन्हा login करा." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "editor"].includes(profile.role)) return NextResponse.json({ error: "फक्त Admin किंवा Editor publish करू शकतो." }, { status: 403 });

  const body = await request.json().catch(() => null) as { newsId?: unknown } | null;
  const newsId = typeof body?.newsId === "string" ? body.newsId : "";
  if (!/^[0-9a-f-]{36}$/i.test(newsId)) return NextResponse.json({ error: "Invalid news id." }, { status: 400 });
  const { data: news, error: newsError } = await supabase.from("news")
    .select("id, title, slug, excerpt, content, featured_image_url, wordpress_post_id")
    .eq("id", newsId).eq("status", "approved").single();
  if (newsError || !news) return NextResponse.json({ error: "Approved बातमी उपलब्ध नाही." }, { status: 404 });
  if (news.wordpress_post_id) return NextResponse.json({ error: "ही बातमी आधीच WordPress वर publish झाली आहे." }, { status: 409 });

  const authorization = `Basic ${Buffer.from(`${wordpressUsername}:${wordpressPassword}`).toString("base64")}`;
  try {
    let featuredMedia: number | undefined;
    if (news.featured_image_url) {
      const imageUrl = new URL(news.featured_image_url);
      const supabaseOrigin = new URL(supabaseUrl).origin;
      if (imageUrl.origin !== supabaseOrigin || !imageUrl.pathname.startsWith("/storage/v1/object/public/news-images/")) {
        return NextResponse.json({ error: "Featured Image URL सुरक्षित Supabase Storage URL नाही." }, { status: 400 });
      }
      const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
      if (!imageResponse.ok) throw new Error("Featured Image download झाली नाही.");
      const imageBytes = await imageResponse.arrayBuffer();
      const filename = imageUrl.pathname.split("/").pop() || `${news.slug || news.id}.jpg`;
      const media = await wordpressRequest(`${wordpressUrl}/wp-json/wp/v2/media`, authorization, {
        method: "POST",
        headers: { "Content-Type": imageResponse.headers.get("content-type") || "image/jpeg", "Content-Disposition": `attachment; filename="${filename.replaceAll('"', "")}"` },
        body: imageBytes,
      });
      featuredMedia = media.id;
    }

    const post = await wordpressRequest(`${wordpressUrl}/wp-json/wp/v2/posts`, authorization, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: news.title, slug: news.slug || undefined,
        excerpt: news.excerpt ? textToHtml(news.excerpt) : undefined,
        content: textToHtml(news.content), status: "publish", featured_media: featuredMedia,
      }),
    });
    const { error: updateError } = await supabase.from("news").update({
      status: "published", wordpress_post_id: post.id, wordpress_url: post.link,
      published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", news.id).eq("status", "approved");
    if (updateError) return NextResponse.json({ error: "WordPress वर publish झाली, पण Newsroom status update झाला नाही.", wordpressUrl: post.link }, { status: 502 });
    return NextResponse.json({ wordpressUrl: post.link });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "WordPress publishing अयशस्वी झाले." }, { status: 502 });
  }
}

