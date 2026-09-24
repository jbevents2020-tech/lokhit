'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type News = { id: string; title: string; content: string; status: string; rejection_reason: string | null };

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const db = useMemo(() => createClient(), []);
  const [news, setNews] = useState<News | null>(null);
  const [staff, setStaff] = useState(false);
  const [message, setMessage] = useState('बातमी उघडत आहे…');
  useEffect(() => {
    let cancelled = false;
    setNews(null);
    setMessage('बातमी उघडत आहे…');
    async function load() {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { window.location.href = `/login?next=${encodeURIComponent(`/news/detail/${id}`)}`; return; }
      const profile = await db.from('profiles').select('role,is_active').eq('id', user.id).single();
      if (cancelled) return;
      if (profile.error || !profile.data?.is_active) { setMessage('Account उपलब्ध नाही.'); return; }
      // User session and RLS authorize this specific article, even for an old notification.
      const result = await db.from('news').select('id,title,content,status,rejection_reason').eq('id', id).maybeSingle();
      if (cancelled) return;
      setStaff(['editor', 'admin'].includes(profile.data.role));
      setNews(result.data);
      setMessage(result.error || !result.data ? 'ही बातमी उपलब्ध नाही किंवा तुम्हाला प्रवेश नाही.' : '');
    }
    load().catch(() => { if (!cancelled) setMessage('बातमी उघडली नाही. पुन्हा प्रयत्न करा.'); });
    return () => { cancelled = true; };
  }, [db, id]);
  return <main className="mx-auto max-w-3xl p-6">
    <Link href="/" className="text-amber-700">← Dashboard</Link>
    {message && <p role="status" className="mt-6">{message}</p>}
    {news && <article className="mt-6 rounded-2xl border bg-white p-6">
      <p className="text-sm text-slate-500">{news.status}</p>
      <h1 className="mt-2 text-2xl font-bold">{news.title}</h1>
      <p className="mt-6 whitespace-pre-wrap leading-8">{news.content}</p>
      {news.status === 'rejected' && news.rejection_reason && <p className="mt-6 rounded-xl bg-red-50 p-4">{news.rejection_reason}</p>}
      {staff && ['submitted','in_review','approved'].includes(news.status) &&
        <Link href={`/review#news-${news.id}`} className="mt-6 inline-block text-amber-700">Review News →</Link>}
    </article>}
  </main>;
}
