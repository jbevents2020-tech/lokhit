"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type UserRow = { id: string; full_name: string | null; email: string | null; role: "admin" | "editor" | "reporter"; is_active: boolean; created_at: string };

export default function UsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "reporter" as "editor" | "reporter" });

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; throw new Error("Session उपलब्ध नाही."); }
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...init?.headers } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Request अयशस्वी झाली.");
    return result;
  }, [supabase]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { const result = await api("/api/admin/users"); setUsers(result.users); }
    catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Users load झाले नाहीत." }); }
    setLoading(false);
  }, [api]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function createUser(event: FormEvent) {
    event.preventDefault(); setWorking("create"); setNotice(null);
    try { await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) }); setForm({ fullName: "", email: "", password: "", role: "reporter" }); setNotice({ type: "success", text: "User यशस्वीपणे तयार झाला." }); await loadUsers(); }
    catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "User तयार झाला नाही." }); }
    setWorking(null);
  }

  async function saveUser(user: UserRow) {
    setWorking(user.id); setNotice(null);
    try { await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: user.id, fullName: user.full_name, role: user.role, isActive: user.is_active }) }); setNotice({ type: "success", text: `${user.full_name || user.email} update झाला.` }); }
    catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Update झाले नाही." }); }
    setWorking(null);
  }

  async function deleteUser(user: UserRow) {
    if (!window.confirm(`${user.full_name || user.email} हा user कायमचा delete करायचा?`)) return;
    setWorking(user.id); setNotice(null);
    try { await api(`/api/admin/users?id=${encodeURIComponent(user.id)}`, { method: "DELETE" }); setUsers((current) => current.filter((item) => item.id !== user.id)); setNotice({ type: "success", text: "User delete झाला." }); }
    catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Delete झाले नाही." }); }
    setWorking(null);
  }

  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><div><div className="text-xl font-black">लोकहित <span className="text-amber-600">Newsroom</span></div><div className="text-xs text-slate-500">User Management</div></div><Link href="/" className="text-sm font-semibold text-slate-600">Dashboard</Link></div></header><section className="mx-auto max-w-6xl px-6 py-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16}/> मागे</Link><div className="mt-5"><p className="text-sm font-semibold text-amber-600">ADMIN WORKSPACE</p><h1 className="mt-1 text-3xl font-black">User Management</h1><p className="mt-1 text-sm text-slate-500">Editor आणि Reporter accounts तयार व manage करा.</p></div>{notice && <div role="status" className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</div>}<form onSubmit={createUser} className="mt-8 grid gap-4 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-5"><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="पूर्ण नाव" className="rounded-xl border px-4 py-3"/><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl border px-4 py-3"/><input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" className="rounded-xl border px-4 py-3"/><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "editor" | "reporter" })} className="rounded-xl border px-4 py-3"><option value="reporter">Reporter</option><option value="editor">Editor</option></select><button disabled={working !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 font-bold text-white disabled:opacity-60">{working === "create" ? <LoaderCircle className="animate-spin" size={17}/> : <Plus size={17}/>} Add User</button></form>{loading ? <div className="mt-6 flex min-h-48 items-center justify-center rounded-2xl border bg-white"><LoaderCircle className="mr-2 animate-spin"/> Users load होत आहेत...</div> : <div className="mt-6 space-y-3">{users.map((user) => <div key={user.id} className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[1.2fr_1.3fr_160px_130px_auto]"><input value={user.full_name || ""} disabled={user.role === "admin"} onChange={(e) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, full_name: e.target.value } : item))} className="rounded-xl border px-3 py-2 disabled:bg-slate-50"/><div className="self-center truncate text-sm text-slate-500">{user.email}</div><select value={user.role} disabled={user.role === "admin"} onChange={(e) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role: e.target.value as "editor" | "reporter" } : item))} className="rounded-xl border px-3 py-2 disabled:bg-slate-50"><option value="admin">Admin</option><option value="editor">Editor</option><option value="reporter">Reporter</option></select><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={user.is_active} disabled={user.role === "admin"} onChange={(e) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, is_active: e.target.checked } : item))}/> Active</label><div className="flex gap-2">{user.role !== "admin" && <><button type="button" onClick={() => saveUser(user)} disabled={working !== null} title="Save" className="rounded-xl border p-2 text-slate-700 disabled:opacity-60"><Save size={17}/></button><button type="button" onClick={() => deleteUser(user)} disabled={working !== null} title="Delete" className="rounded-xl border border-red-200 p-2 text-red-600 disabled:opacity-60"><Trash2 size={17}/></button></>}</div></div>)}</div>}</section></main>;
}

