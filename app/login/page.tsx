import Link from "next/link";
import { ArrowLeft, LockKeyhole, Newspaper } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Dashboard</Link>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-white"><Newspaper size={24}/></div>
          <div><h1 className="text-2xl font-black">लोकहित Newsroom</h1><p className="text-sm text-slate-500">Secure newsroom login</p></div>
        </div>
        <form className="space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email</span><input type="email" placeholder="name@example.com" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><div className="relative"><LockKeyhole className="absolute left-4 top-3.5 text-slate-400" size={18}/><input type="password" placeholder="••••••••" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-amber-500" /></div></label>
          <button type="button" className="w-full rounded-xl bg-amber-600 px-4 py-3.5 font-bold text-white hover:bg-amber-700">Login</button>
        </form>
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">Authentication will be connected to Supabase in the next phase.</p>
      </div>
    </main>
  );
}
