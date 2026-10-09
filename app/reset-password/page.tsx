"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Newspaper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function prepareRecoverySession() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setReady(Boolean(data.session));
        if (!data.session) setError("Reset link invalid किंवा expired आहे. नवीन reset link मागवा.");
      }
    }
    void prepareRecoverySession();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setReady(true);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password किमान 8 अक्षरांचा असावा.");
    if (password !== confirmPassword) return setError("दोन्ही passwords जुळत नाहीत.");
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    await supabase.auth.signOut();
    setComplete(true);
  }

  return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-3 py-6 sm:px-4 sm:py-10"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8"><div className="mb-8 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-white"><Newspaper size={24}/></div><div><h1 className="text-2xl font-black">लोकहित Newsroom</h1><p className="text-sm text-slate-500">नवीन password तयार करा</p></div></div>{complete ? <div className="space-y-5"><div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">Password यशस्वीपणे बदलला आहे.</div><Link href="/login" className="block rounded-xl bg-amber-600 px-4 py-3.5 text-center font-bold text-white">Login करा</Link></div> : <form onSubmit={updatePassword} className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">नवीन Password</span><div className="relative"><LockKeyhole className="absolute left-4 top-3.5 text-slate-400" size={18}/><input required minLength={8} disabled={!ready} value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-12 outline-none focus:border-amber-500"/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Password लपवा" : "Password दाखवा"} className="absolute right-3 top-2.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password पुन्हा लिहा</span><div className="relative"><input required minLength={8} disabled={!ready} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 py-3 pl-4 pr-12 outline-none focus:border-amber-500"/><button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Password लपवा" : "Password दाखवा"} className="absolute right-3 top-2.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">{showConfirmPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button disabled={!ready || loading} className="w-full rounded-xl bg-amber-600 px-4 py-3.5 font-bold text-white disabled:opacity-60">{loading ? "Password बदलत आहे..." : ready ? "Password बदला" : "Reset link तपासत आहे..."}</button></form>}</div></main>;
}
