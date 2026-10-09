"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, FileText, LoaderCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = { id: string; articleId: string; title: string; message: string; url: string; createdAt: string };
const seenKey = "lokhit_seen_notifications";

export function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession(); if (!session) return;
    setLoading(true);
    try { const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }); const result = await response.json(); if (response.ok) setItems(result.notifications ?? []); } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { try { setSeen(new Set(JSON.parse(localStorage.getItem(seenKey) || "[]"))); } catch {} load(); }, [load]);
  useEffect(() => { const channel = supabase.channel("lokhit-news-notifications").on("postgres_changes", { event: "*", schema: "public", table: "news" }, load).subscribe(); return () => { supabase.removeChannel(channel); }; }, [load, supabase]);
  useEffect(() => { const close = (event: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);

  const unread = items.filter((item) => !seen.has(item.id)).length;
  function persist(next: Set<string>) { setSeen(next); try { localStorage.setItem(seenKey, JSON.stringify([...next])); } catch {} }
  function openItem(item: Notification) { persist(new Set(seen).add(item.id)); setOpen(false); if (/^https?:\/\//.test(item.url)) window.open(item.url, "_blank", "noopener,noreferrer"); else window.location.href = item.url; }
  function markAll() { persist(new Set([...seen, ...items.map((item) => item.id)])); }

  return <div ref={panelRef} className="relative"><button type="button" onClick={() => { setOpen((value) => !value); if (!open) load(); }} aria-label="सूचना" className="relative rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700"><Bell size={18}/>{unread > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-black text-white">{unread > 99 ? "99+" : unread}</span>}</button>{open && <div className="fixed left-3 right-3 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-50 overflow-hidden rounded-2xl border bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"><div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><div><p className="font-bold">सूचना</p><p className="text-xs text-slate-500">{unread} नवीन</p></div><div className="flex gap-1"><button type="button" onClick={markAll} title="सर्व वाचले" className="rounded-lg p-2 text-slate-600"><CheckCheck size={17}/></button><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-600"><X size={17}/></button></div></div><div className="max-h-[65vh] divide-y overflow-y-auto">{loading && items.length === 0 ? <div className="flex items-center justify-center p-8 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/> लोड होत आहे...</div> : items.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">नवीन सूचना नाही.</div> : items.map((item) => <button key={item.id} type="button" onClick={() => openItem(item)} className={`flex w-full gap-3 p-4 text-left ${seen.has(item.id) ? "bg-white" : "bg-amber-50"}`}><span className="mt-1 rounded-lg bg-slate-100 p-2 text-slate-600"><FileText size={16}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span><span className="mt-2 block text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString("mr-IN")}</span></span>{!seen.has(item.id) && <span className="mt-2 h-2 w-2 rounded-full bg-amber-600"/>}</button>)}</div></div>}</div>;
}
