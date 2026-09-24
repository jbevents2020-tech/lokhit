import { timingSafeEqual } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { createClient } from '@supabase/supabase-js';
import { Delivery, isDeadToken, mayReceive, pushData, retrySeconds } from '@/lib/push/message';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  const supplied = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (!secret || secret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!url || !key || !projectId || !clientEmail || !privateKey) {
    return Response.json({ error: 'Push configuration incomplete' }, { status: 503 });
  }
  try {
    const app = getApps().find(app => app.name === 'newsroom-push') ?? initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    }, 'newsroom-push');
    const messaging = getMessaging(app);
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.rpc('claim_push_deliveries');
    if (error) throw new Error('Queue unavailable');
    const deliveries = (data ?? []) as Delivery[];
    const outcomes = await Promise.allSettled(deliveries.map(async delivery => {
      const finish = async (last_error: string | null) => {
        const { error } = await db.from('push_deliveries').update({ completed_at: new Date().toISOString(), last_error })
          .eq('id', delivery.id).eq('lease_id', delivery.lease_id);
        if (error) throw new Error('Queue update failed');
      };
      const [device, profile, news] = await Promise.all([
        db.from('device_tokens').select('fcm_token,updated_at').eq('id', delivery.device_id).eq('user_id', delivery.recipient_id).maybeSingle(),
        db.from('profiles').select('role,is_active').eq('id', delivery.recipient_id).maybeSingle(),
        db.from('news').select('author_id').eq('id', delivery.news_id).maybeSingle(),
      ]);
      if (device.error || profile.error || news.error) throw new Error('Recipient lookup failed');
      if (!device.data || !profile.data || !news.data || !mayReceive(delivery, profile.data, news.data.author_id)
        || Date.parse(device.data.updated_at) < Date.now() - 60 * 86400000
        || Date.parse(delivery.created_at) < Date.now() - 86400000) {
        await finish('recipient_unavailable_or_expired'); return;
      }
      try {
        await messaging.send({ token: device.data.fcm_token, data: pushData(delivery),
          android: { priority: 'high', ttl: 3600 * 1000 } });
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'send_failed';
        if (isDeadToken(code)) {
          // Do not delete a new token registered while this send was in flight.
          const deleted = await db.from('device_tokens').delete().eq('id', delivery.device_id).eq('fcm_token', device.data.fcm_token);
          if (deleted.error) throw new Error('Token cleanup failed');
          await finish(code); return;
        }
        const saved = await db.from('push_deliveries').update({
          last_error: code.slice(0, 100),
          available_at: new Date(Date.now() + retrySeconds(delivery.attempts) * 1000).toISOString(),
          completed_at: delivery.attempts >= 8 ? new Date().toISOString() : null,
        }).eq('id', delivery.id).eq('lease_id', delivery.lease_id);
        if (saved.error) throw new Error('Retry update failed');
        return;
      }
      await finish(null);
    }));
    if (outcomes.some(outcome => outcome.status === 'rejected')) throw new Error('Delivery processing failed');
    return Response.json({ processed: deliveries.length });
  } catch {
    // Never log service credentials, FCM tokens, or article payloads.
    return Response.json({ error: 'Push processing failed; queued deliveries will retry' }, { status: 503 });
  }
}
