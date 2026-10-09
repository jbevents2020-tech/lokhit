"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Newspaper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function sendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-3 py-6 sm:px-4 sm:py-10"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8"><Link href="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Login</Link><div className="mb-8 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-white"><Newspaper size={24}/></div><div><h1 className="text-2xl font-black">लोकहित Newsroom</h1><p className="text-sm text-slate-500">Password Recovery</p></div></div>{sent ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-800">Password reset link पाठवली आहे. Email inbox आणि Spam folder तपासा.</div> : <form onSubmit={sendResetLink} className="space-y-5"><p className="text-sm leading-6 text-slate-600">तुमच्या Newsroom account चा email द्या.</p><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email</span><div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400" size={18}/><input required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-amber-500" placeholder="name@example.com"/></div></label>{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-amber-600 px-4 py-3.5 font-bold text-white disabled:opacity-60">{loading ? "Link पाठवत आहे..." : "Reset link पाठवा"}</button></form>}</div></main>;
}
