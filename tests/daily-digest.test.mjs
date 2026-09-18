import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indiaDay, digestMessages, safeArticleLink } from '../lib/daily-digest.ts';

test('Indian day boundaries include midnight correctly, independent of machine timezone', () => {
  assert.deepEqual(indiaDay(new Date('2026-09-18T18:29:59Z')), { date: '2026-09-18', start: '2026-09-17T18:30:00.000Z', end: '2026-09-18T18:30:00.000Z' });
  assert.equal(indiaDay(new Date('2026-09-18T18:30:00Z')).date, '2026-09-19');
});
test('messages retain ordered headlines, excerpts and complete links, with safe fallbacks', () => {
  const article = { id: '1', title: 'पहिली बातमी', excerpt: '<p>छोटा सारांश</p>', wordpress_url: 'https://news.example/one?a=1&b=2' };
  const message = digestMessages([article, { ...article, id: '2', title: 'दुसरी बातमी', excerpt: '', content: 'संपूर्ण बातमी' }], '2026-09-18', true).join('\n');
  assert.ok(message.includes('*1. पहिली बातमी*\nछोटा सारांश\n🔗 https://news.example/one?a=1&b=2'));
  assert.ok(message.includes('*2. दुसरी बातमी*\nसंपूर्ण बातमी'));
  assert.ok(message.includes('आजच्या ठळक बातम्या'));
  assert.deepEqual(digestMessages([], '2026-09-18'), []);
  assert.equal(safeArticleLink('javascript:alert(1)'), false);
  assert.equal(safeArticleLink('https://user:pass@example.com'), false);
});
test('large Marathi digests split without losing or duplicating articles', () => {
  const articles = Array.from({ length: 30 }, (_, i) => ({ id: String(i), title: `बातमी ${i}`, excerpt: 'मराठी बातमीचा सारांश '.repeat(30), wordpress_url: `https://news.example/${i}` }));
  const messages = digestMessages(articles, '2026-09-18');
  assert.ok(messages.length > 1);
  assert.equal(messages.join('\n').match(/🔗 /g).length, 30);
  for (const [index, message] of messages.entries()) {
    assert.ok(message.includes(`भाग ${index + 1}/${messages.length}`));
    assert.ok(encodeURIComponent(message).length < 8000);
  }
});
