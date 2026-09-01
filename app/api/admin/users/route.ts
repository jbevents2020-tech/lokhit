import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ManagedRole = "editor" | "reporter";

async function getAdmin(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) return { error: NextResponse.json({ error: "Supabase Admin configuration उपलब्ध नाही." }, { status: 503 }) };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "Authentication आवश्यक आहे." }, { status: 401 }) };
  const viewer = createClient(url, publicKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await viewer.auth.getUser(token);
  if (!user) return { error: NextResponse.json({ error: "Session invalid आहे." }, { status: 401 }) };
  const { data: profile } = await viewer.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "फक्त Adminला User Management access आहे." }, { status: 403 }) };
  return { admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), userId: user.id };
}

export async function GET(request: Request) {
  const context = await getAdmin(request);
  if ("error" in context) return context.error;
  const { data, error } = await context.admin.from("profiles").select("id, full_name, email, role, is_active, created_at").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  const context = await getAdmin(request);
  if ("error" in context) return context.error;
  const body = await request.json().catch(() => null) as { fullName?: unknown; email?: unknown; password?: unknown; role?: unknown } | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role as ManagedRole;
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !["editor", "reporter"].includes(role)) return NextResponse.json({ error: "नाव, valid email, किमान 8 अक्षरांचा password आणि role आवश्यक आहे." }, { status: 400 });
  const { data, error } = await context.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) return NextResponse.json({ error: error?.message || "User तयार झाला नाही." }, { status: 400 });
  const { error: profileError } = await context.admin.from("profiles").upsert({ id: data.user.id, full_name: fullName, email, role, is_active: true, updated_at: new Date().toISOString() });
  if (profileError) { await context.admin.auth.admin.deleteUser(data.user.id); return NextResponse.json({ error: profileError.message }, { status: 500 }); }
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const context = await getAdmin(request);
  if ("error" in context) return context.error;
  const body = await request.json().catch(() => null) as { id?: unknown; fullName?: unknown; role?: unknown; isActive?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const role = body?.role as ManagedRole;
  if (!id || !fullName || !["editor", "reporter"].includes(role) || typeof body?.isActive !== "boolean") return NextResponse.json({ error: "Invalid user update." }, { status: 400 });
  const { data: target } = await context.admin.from("profiles").select("role").eq("id", id).single();
  if (target?.role === "admin" || id === context.userId) return NextResponse.json({ error: "Admin account येथे edit करता येणार नाही." }, { status: 400 });
  const { error } = await context.admin.from("profiles").update({ full_name: fullName, role, is_active: body.isActive, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const context = await getAdmin(request);
  if ("error" in context) return context.error;
  const id = new URL(request.url).searchParams.get("id") || "";
  const { data: target } = await context.admin.from("profiles").select("role").eq("id", id).single();
  if (!id || target?.role === "admin" || id === context.userId) return NextResponse.json({ error: "Admin account delete करता येणार नाही." }, { status: 400 });
  const { error } = await context.admin.auth.admin.deleteUser(id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true });
}

