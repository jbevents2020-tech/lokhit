import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { isDeadToken, mayReceive, pushData, retrySeconds, type Delivery } from '../lib/push/message';
import { safeNewsPath } from '../lib/push/path';

test('payload privacy, changed roles, safe links and retry policy', () => {
  const delivery = { audience: 'admin', recipient_id: 'a', news_id: '12345678-1234-1234-1234-123456789012',
    headline: 'Headline\ntext', context: 'editor · approved', news_status: 'approved', event_id: 'event' } as Delivery;
  assert.equal(mayReceive(delivery, { role: 'reporter', is_active: true }, 'a'), false);
  assert.equal(mayReceive(delivery, { role: 'admin', is_active: false }, 'a'), false);
  assert.equal(mayReceive(delivery, { role: 'admin', is_active: true }, 'a'), true);
  const payload = pushData(delivery);
  assert.equal(payload.title, 'Headline text');
  assert.equal(safeNewsPath(payload.path), payload.path);
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', '/news/detail/../users']) assert.equal(safeNewsPath(bad), '/');
  assert.equal('content' in payload, false);
  assert.equal('rejection_reason' in payload, false);
  assert.equal(isDeadToken('messaging/invalid-argument'), false);
  assert.equal(isDeadToken('messaging/registration-token-not-registered'), true);
  assert.ok(retrySeconds(8) <= 3600);
});

test('real SQL: audiences, multiple devices, RLS, refresh, cleanup and leasing', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid, bucket_id text, name text);
      create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;`);
    const schema = (await readFile('supabase/schema.sql', 'utf8')).replace('create extension if not exists pgcrypto;', '');
    await db.exec(schema);
    await db.exec(await readFile('supabase/migrations/20260915_push_notifications.sql', 'utf8'));
    const ids = ['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
    for (const id of ids) await db.query('insert into auth.users(id) values ($1)', [id]);
    await db.query("update public.profiles set role='editor' where id=$1", [ids[1]]);
    await db.query("update public.profiles set role='admin' where id=$1", [ids[2]]);
    await db.exec('grant select,insert,update,delete on public.profiles,public.news to authenticated');
    const asUser = async (id: string) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
    for (let i=0;i<3;i++) { await asUser(ids[i]); await db.query('select public.register_push_device($1,$2)',[ids[i],`token-device-${i}-abcdefghijklmnop`]); }
    await asUser(ids[0]);
    const secondDevice = '00000000-0000-0000-0000-000000000004';
    await db.query('select public.register_push_device($1,$2)',[secondDevice,'token-second-abcdefghijklmnop']);
    await assert.rejects(db.query('select * from public.device_tokens'));
    await assert.rejects(db.query('select public.claim_push_deliveries()'));
    await assert.rejects(db.query("update public.profiles set role='admin' where id=$1",[ids[0]]));
    await assert.rejects(db.query("insert into public.news(title,status,author_id) values ('forged','approved',$1)",[ids[0]]));
    const { rows } = await db.query<{id:string}>("insert into public.news(title,status,author_id) values ('Test','draft',$1) returning id",[ids[0]]);
    const newsId = rows[0].id;
    await db.exec('reset role');
    assert.equal((await db.query('select * from push_deliveries')).rows.length, 0);
    await asUser(ids[0]);
    await db.query("update public.news set status='submitted' where id=$1",[newsId]);
    await db.exec('reset role');
    assert.equal((await db.query('select * from push_deliveries')).rows.length, 2);
    await asUser(ids[1]);
    await db.query("update public.news set status='approved' where id=$1",[newsId]);
    await db.query("update public.news set status='approved' where id=$1",[newsId]);
    await db.exec('reset role');
    assert.equal((await db.query('select * from push_deliveries')).rows.length, 5); // two author devices + admin
    await asUser(ids[1]);
    await db.query("insert into public.news(title,status,author_id) values ('Editor submission','submitted',$1)",[ids[1]]);
    await db.exec('reset role');
    assert.equal((await db.query('select * from push_deliveries')).rows.length, 6);
    await db.exec('set role service_role');
    assert.equal((await db.query('select * from claim_push_deliveries()')).rows.length, 6);
    assert.equal((await db.query('select * from claim_push_deliveries()')).rows.length, 0);
    await asUser(ids[1]);
    await db.query("update public.news set status='rejected' where id=$1",[newsId]);
    await db.query("update public.news set status='published' where id=$1",[newsId]);
    await assert.rejects(db.query('update public.news set author_id=$1 where id=$2',[ids[1],newsId]));
    await db.exec('reset role');
    const statuses = await db.query<{news_status:string}>("select news_status from push_deliveries where news_status in ('rejected','published')");
    assert.equal(statuses.rows.filter(row => row.news_status === 'rejected').length, 2);
    assert.equal(statuses.rows.filter(row => row.news_status === 'published').length, 2);
    await asUser(ids[0]);
    await db.query('select register_push_device($1,$2)',[ids[0],'refreshed-token-abcdefghijklmnop']);
    await assert.rejects(db.query('select register_push_device($1,$2)',[ids[1],'stolen-token-abcdefghijklmnop']));
    await db.query('select unregister_push_device($1)',[ids[1]]); // cannot remove another user
    await db.query('select unregister_push_device($1)',[ids[0]]);
    await db.exec('reset role');
    assert.equal((await db.query('select * from device_tokens')).rows.length, 3);
  } finally { await db.close(); }
});
