import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase configuration missing" }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const staff = profile?.role === "admin" || profile?.role === "editor";
  let query = supabase.from("news").select("id, title, status, rejection_reason, wordpress_url, updated_at, author_id").order("updated_at", { ascending: false }).limit(30);
  query = staff ? query.in("status", ["submitted", "in_review", "approved"]) : query.eq("author_id", user.id).in("status", ["rejected", "approved", "published"]);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const notifications = (data ?? []).map((item) => ({
    id: `${item.id}:${item.status}`,
    articleId: item.id,
    title: item.status === "rejected" ? "बातमी बदलासाठी परत आली" : item.status === "published" ? "बातमी प्रकाशित झाली" : item.status === "approved" ? "बातमी मंजूर झाली" : "नवीन बातमी Review साठी आली",
    message: item.rejection_reason || item.title,
    url: item.status === "published" && item.wordpress_url ? item.wordpress_url : staff ? "/review" : "/my-news",
    createdAt: item.updated_at,
  }));
  return NextResponse.json({ notifications });
}
