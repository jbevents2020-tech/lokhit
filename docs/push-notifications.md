# Android push notifications — backend integration

## Status

The existing `jbevents2020-tech/lokhit` repository contains Next.js and Supabase code, but **no Android project**. The discovered `jbevents2020-tech/wartaa-newsroomAndroidSystem` repository is empty. The backend implementation and authenticated detail route are ready for integration. Android FCM service, permission prompt, device lifecycle, notification display, native deep-link routing, APK build and real-device delivery remain pending the existing Android source. Do not activate production dispatch until that client is integrated and tested.

## Implemented behavior

- Database trigger catches direct Supabase writes and existing web/WordPress publishing writes.
- New `submitted` status from a reporter/user → active Editors and Admins, excluding the actor.
- Editor submission or meaningful title/content/excerpt/status update while submitted/in-review/approved → Admins.
- Transition to approved/rejected/published → original author, on all registered devices. Editor approval also informs Admins. Repeated saves with no meaningful change do not enqueue another event.
- No organizational/assignment scope exists in the inspected schema, so relevant staff means all active staff in this newsroom. Add scope checks before supporting multiple newsrooms.
- Device RPCs derive ownership from the Supabase access token. Clients cannot read/list tokens or edit the queue. Role/activation changes use the existing service-role Admin API; authenticated clients cannot change their own role. Authenticated news edits cannot replace the original author.
- Deliveries are durable, leased in batches of 20 for five minutes, retried with backoff up to eight attempts, and skipped when older than one day. Device registrations expire from delivery eligibility after 60 days without a refresh.
- Recipient activity, role and ownership are rechecked before sending. Invalid/unregistered FCM tokens are removed only if the token has not changed during the send.
- FCM data contains headline (max 160 characters), actor role/status, event/news/recipient IDs and a relative detail path. It excludes article body, email and rejection reasons.
- Sending is at-least-once: a process stopping after FCM accepts but before acknowledgement can produce a duplicate. Android must persistently deduplicate `event_id` per account.

## One-time Firebase Console setup

1. Select/create the Firebase project for this app; register the **existing Android application ID**. Do not invent a package name or replace the existing app.
2. Place its `google-services.json` in the Android app module locally. It is ignored here. Add Google Services and Firebase Messaging dependencies appropriate to the actual Android project.
3. Enable Firebase Cloud Messaging HTTP v1. Create a server service account with permission to send FCM messages (Firebase Cloud Messaging API Admin role), and securely obtain its credentials.
4. Never commit its private key or service-account JSON. Set server values in Vercel, not Android resources or public JavaScript.

## Vercel environment

Keep existing Supabase and publishing variables. Configure the production environment:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server-only Supabase service key |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Server service account email |
| `FIREBASE_PRIVATE_KEY` | PEM private key; actual newlines or escaped `\n` supported |
| `PUSH_DISPATCH_SECRET` | Random secret of at least 32 ASCII characters |

Use separate test credentials for previews. Redeploy after setting environment values. Never send production notifications from a preview deployment against production Supabase.

## Supabase setup

1. Review and apply `supabase/migrations/20260915_push_notifications.sql` once using migrations or the SQL Editor. It adds tables/functions/triggers without replacing schema/data. Do not rerun the full foundation schema. Back up the database and test the migration in staging first.
2. After the Android client is ready, create a Database Webhook on `public.push_deliveries`, **INSERT only**, targeting `https://lokhit-wbja.vercel.app/api/push/dispatch`, POST. Set `Authorization: Bearer <PUSH_DISPATCH_SECRET>`. The worker deliberately ignores webhook payload and claims trusted database deliveries. Protect webhook configuration as a secret.
3. Enable `pg_cron` and `pg_net`. In Supabase Vault create `push_dispatch_url` (the same endpoint) and `push_dispatch_secret` (the same secret). Run the following once for retry recovery:

```sql
select cron.schedule('lokhit-push-retry', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
```

4. Monitor failed/exhausted deliveries (SQL Editor/service role only):

```sql
select id, attempts, last_error, available_at, completed_at
from public.push_deliveries
where last_error is not null or (completed_at is null and attempts >= 8)
order by created_at desc;
```

Retry an exhausted delivery only after diagnosing configuration, and while it is less than one day old. Delete completed deliveries older than 30 days on a scheduled maintenance job to limit headline retention. Stop the webhook and unschedule `lokhit-push-retry` to pause sending; existing news functionality continues.

## Android integration contract (pending source)

- Declare `POST_NOTIFICATIONS`; request it at runtime on Android 13+ with rationale and denial handling. Create channel `news_workflow` before displaying notifications; honor app/channel notification settings.
- Register a non-exported `FirebaseMessagingService`; implement `onNewToken` and `onMessageReceived`. After authenticated login, permission grant and each app start, obtain the current FCM token and call Supabase RPC `register_push_device` with `p_installation_id` (persisted random UUID) and `p_token`. Refresh registration periodically while signed in. Retry network failures via the app's background work mechanism using the current account session.
- Multiple devices use different installation IDs. Token refresh updates the same installation. Never log tokens. Persist pending refresh if it arrives before authentication; never attach it to a stale account.
- Before logout/account switching, unregister this installation via `unregister_push_device(p_installation_id)`, delete the local FCM token, clear pending registration jobs and all displayed notifications, and then clear auth. If offline, immediately disable local display/clear local recipient state and delete FCM token; retry cleanup when possible. A conflicting old server registration requires cleanup or a fresh installation/token; the RPC never silently transfers another account's token.
- Payload is **data-only** to prevent background auto-display after logout. Verify the signed-in local recipient matches `recipient_id`, honor permission, and deduplicate `event_id` before displaying a private-visibility notification. Use an immutable, news-specific PendingIntent with a unique identifier; never reuse one PendingIntent for all articles.
- Open the relevant screen by validated UUID: `/news/detail/<news_id>`. The web route loads that exact news item with the user session/RLS and offers the matching review entry to staff. For native navigation, use the actual app router; for a WebView, allow only the configured newsroom HTTPS origin. Do not load arbitrary payload URLs.
- Persist the intended news ID through cold start/login. Recheck access before displaying details. Account changes, removed articles and revoked roles must show an unavailable/access-denied state, never cached private content.
- Data-only FCM delivery may be delayed by Android power management and does not arrive while force-stopped until the user reopens the app. Avoid long work in the messaging callback.

## Verification

Automated: `npm run test:push` uses an isolated PostgreSQL-compatible engine with the actual foundation schema and migration. It checks ownership restrictions, role protection, audience routing, multi-device approval/rejection/publication, repeated-save deduplication, token refresh, logout deletion, leases, dispatch authentication and payload/link safety.

Dependency audit currently reports two moderate transitive findings in Firebase's `gaxios` / `uuid` chain (GHSA-w5hq-g745-h8pq). A normal `npm audit fix` did not resolve them. No forced major-version override has been applied; recheck upstream updates before release.

Build: `npm run build` requires the existing public Supabase settings. Build-only placeholders can verify compilation/prerendering but do not verify live auth/database connectivity.

Before release: verify real-device foreground/background/cold-start notification tap, Android 13 allow/deny, reporter/editor/admin transitions, second device, token rotation, offline logout/account switch, role revocation, deleted news, FCM outage retries and expired-token cleanup. Confirm deployed migration/worker and an actual test-device notification. Android build and live delivery cannot be claimed until these pass.

References: [Android FCM setup](https://firebase.google.com/docs/cloud-messaging/android/get-started), [token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens), [FCM errors](https://firebase.google.com/docs/cloud-messaging/error-codes).
