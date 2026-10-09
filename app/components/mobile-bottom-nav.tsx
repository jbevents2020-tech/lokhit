"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, MoreHorizontal, PenLine, Send, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "editor" | "reporter";

export function MobileBottomNav() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<Role | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(async ({ data: { user } }) => { if (!user) return; const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single(); if (data?.role) setRole(data.role as Role); }); }, [supabase]);
  useEffect(() => {
    const closeMoreOnBack = () => setMoreOpen(false);
    window.addEventListener("popstate", closeMoreOnBack);
    return () => window.removeEventListener("popstate", closeMoreOnBack);
  }, []);
  function toggleMore() {
    if (moreOpen) {
      window.history.back();
      return;
    }
    window.history.pushState({ ...window.history.state, mobileMoreMenu: true }, "");
    setMoreOpen(true);
  }
  function closeMoreForNavigation() {
    if (!moreOpen) return;
    const nextState = { ...window.history.state };
    delete nextState.mobileMoreMenu;
    window.history.replaceState(nextState, "");
    setMoreOpen(false);
  }
  async function logout() { await supabase.auth.signOut(); window.location.href = "/login"; }
  const staff = role === "admin" || role === "editor";
  const itemClass = (active: boolean) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${active ? "bg-amber-50 text-amber-700" : "text-slate-600"}`;
  if (pathname === "/login") return null;
  return <><div aria-hidden="true" className="h-20 md:hidden"/><nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden"><div className="mx-auto grid max-w-lg grid-cols-5 items-end"><Link href="/" className={itemClass(pathname === "/")}><LayoutDashboard size={20}/><span>Dashboard</span></Link><Link href="/news" className={itemClass(pathname.startsWith("/news"))}><PenLine size={20}/><span>नवीन</span></Link><Link href="/my-news" className={itemClass(pathname.startsWith("/my-news"))}><FileText size={20}/><span>माझ्या</span></Link>{staff ? <Link href="/review" className={itemClass(pathname.startsWith("/review"))}><Send size={20}/><span>Review</span></Link> : <span className="min-h-14"/>}<div className="relative"><button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={toggleMore} className={`${itemClass(["/all-news", "/users"].some((path) => pathname.startsWith(path)))} w-full`}><MoreHorizontal size={22}/><span>More</span></button>{moreOpen && <div role="menu" className="absolute bottom-16 right-0 w-56 space-y-1 rounded-2xl border bg-white p-2 text-sm shadow-2xl">{staff && <Link href="/all-news" onClick={closeMoreForNavigation} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-slate-700"><FileText size={18}/> सर्व बातम्या</Link>}{role === "admin" && <Link href="/users" onClick={closeMoreForNavigation} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-slate-700"><Users size={18}/> User Management</Link>}<button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-semibold text-red-600"><LogOut size={18}/> Logout</button></div>}</div></div></nav></>;
}
