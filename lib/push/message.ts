export type Delivery = {
  id: string; event_id: string; news_id: string; recipient_id: string; device_id: string;
  audience: 'staff' | 'admin' | 'author'; headline: string; context: string;
  news_status: string; created_at: string; attempts: number; lease_id: string;
};

export function mayReceive(delivery: Delivery, profile: { role: string; is_active: boolean }, authorId: string | null) {
  return profile.is_active && (delivery.audience === 'author'
    ? authorId === delivery.recipient_id
    : delivery.audience === 'admin' ? profile.role === 'admin' : ['admin', 'editor'].includes(profile.role));
}

export function pushData(delivery: Delivery) {
  // Data-only: Android verifies the recipient before displaying anything, including
  // on a shared phone after logout. Never include body, email or rejection reasons.
  return {
    event_id: delivery.event_id,
    news_id: delivery.news_id,
    recipient_id: delivery.recipient_id,
    title: delivery.headline.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 160),
    context: delivery.context,
    status: delivery.news_status,
    path: `/news/detail/${delivery.news_id}`,
  };
}

export function retrySeconds(attempt: number) {
  return Math.min(3600, 30 * 2 ** Math.min(attempt, 7));
}

export function isDeadToken(code: string) {
  return ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code);
}
