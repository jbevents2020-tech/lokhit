import { FileText, ImagePlus, LayoutDashboard, PenLine, Send, Sparkles, Users } from "lucide-react";

const stats = [
  ["एकूण बातम्या", "128", "या महिन्यात +18"],
  ["प्रलंबित", "12", "Editor review"],
  ["प्रकाशित", "96", "या महिन्यात"],
  ["Reporters", "14", "Active users"],
];

const workflow = [
  { label: "Draft", count: 24, icon: PenLine },
  { label: "Submitted", count: 12, icon: Send },
  { label: "Published", count: 96, icon: FileText },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-2xl font-black tracking-tight">लोकहित <span className="text-amber-600">Newsroom</span></div>
            <div className="text-xs text-slate-500">Digital News Publishing Platform</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Admin</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">A</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r bg-white p-4 md:block">
          <nav className="space-y-1 text-sm">
            <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"><LayoutDashboard size={17}/> Dashboard</div>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600"><PenLine size={17}/> नवीन बातमी</div>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600"><FileText size={17}/> सर्व बातम्या</div>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600"><Users size={17}/> Reporters</div>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600"><Sparkles size={17}/> Gemini AI</div>
          </nav>
        </aside>

        <section className="p-6 md:p-8">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold text-amber-600">GOOD EVENING</p><h1 className="mt-1 text-3xl font-black">Newsroom Dashboard</h1><p className="mt-1 text-sm text-slate-500">आजच्या newsroom कामाचा आढावा</p></div>
            <button className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-sm"><PenLine size={17}/> नवीन बातमी तयार करा</button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([title, value, note]) => <div key={title} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-medium text-emerald-600">{note}</p></div>)}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between"><div><h2 className="font-bold">Publishing Workflow</h2><p className="text-sm text-slate-500">बातमी कोणत्या stage वर आहे</p></div><Sparkles className="text-amber-600" size={20}/></div>
              <div className="mt-6 space-y-4">{workflow.map(({label,count,icon:Icon}) => <div key={label} className="flex items-center gap-4"><div className="rounded-xl bg-slate-100 p-3"><Icon size={18}/></div><div className="flex-1"><div className="flex justify-between text-sm font-semibold"><span>{label}</span><span>{count}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-amber-500" style={{width:`${Math.min(count,100)}%`}} /></div></div></div>)}</div>
            </div>
            <div className="rounded-2xl border bg-slate-900 p-6 text-white shadow-sm">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-white/10 p-3"><Sparkles size={20}/></div><div><h2 className="font-bold">Gemini AI</h2><p className="text-xs text-slate-300">News writing assistant</p></div></div>
              <p className="mt-6 text-sm leading-6 text-slate-300">कच्ची माहिती द्या. AI headline, बातमी, excerpt, SEO slug आणि tags तयार करण्यास मदत करेल.</p>
              <button className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900">AI News Generator उघडा</button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><ImagePlus size={20} className="text-amber-600"/><div><h2 className="font-bold">Next: News Creator</h2><p className="text-sm text-slate-500">Reporter → Editor → WordPress publishing workflow पुढील phase मध्ये जोडला जाईल.</p></div></div></div>
        </section>
      </div>
    </main>
  );
}
