import Link from "next/link";
import { ArrowLeft, ImagePlus, Sparkles, Send } from "lucide-react";

export default function NewsCreatorPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div><div className="text-xl font-black">लोकहित <span className="text-amber-600">Newsroom</span></div><div className="text-xs text-slate-500">News Creator</div></div>
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Dashboard</Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16}/> मागे</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-amber-600">REPORTER WORKSPACE</p><h1 className="mt-1 text-3xl font-black">नवीन बातमी तयार करा</h1><p className="mt-1 text-sm text-slate-500">बातमी लिहा, AI मदत घ्या आणि editor कडे submit करा.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"><Sparkles size={17}/> Gemini AI</button></div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_330px]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2"><span className="mb-2 block text-sm font-semibold">बातमीचे शीर्षक</span><input placeholder="उदा. जिल्ह्यातील महत्त्वाची बातमी..." className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Category</span><select className="w-full rounded-xl border border-slate-200 px-4 py-3"><option>निवडा</option><option>राजकारण</option><option>स्थानिक</option><option>शिक्षण</option><option>क्रीडा</option><option>मनोरंजन</option></select></label>
              <label><span className="mb-2 block text-sm font-semibold">Location</span><input placeholder="शहर / तालुका / जिल्हा" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" /></label>
              <label className="md:col-span-2"><span className="mb-2 block text-sm font-semibold">बातमीचा मजकूर</span><textarea rows={12} placeholder="बातमीची संपूर्ण माहिती येथे लिहा..." className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" /></label>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Draft जतन करा</button><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white"><Send size={17}/> Editor कडे Submit करा</button></div>
          </div>
          <aside className="space-y-6">
            <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><ImagePlus size={20}/></div><div><h2 className="font-bold">Featured Image</h2><p className="text-xs text-slate-500">मुख्य फोटो upload करा</p></div></div><div className="mt-5 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Image upload येथे येईल</div></div>
            <div className="rounded-2xl bg-slate-900 p-5 text-white"><h2 className="font-bold">AI Assistant</h2><p className="mt-2 text-sm leading-6 text-slate-300">Raw information वरून headline, article, excerpt, SEO slug आणि tags तयार करण्यासाठी Gemini जोडले जाईल.</p><button className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900">AI ने बातमी तयार करा</button></div>
          </aside>
        </div>
      </section>
    </main>
  );
}
