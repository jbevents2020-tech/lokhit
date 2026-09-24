import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../app/api/push/dispatch/route';

test('dispatch rejects missing/wrong secrets without claiming any work', async () => {
  process.env.PUSH_DISPATCH_SECRET = 'test-only-secret-abcdefghijklmnopqrstuvwxyz';
  for (const authorization of ['', 'Bearer wrong', `Bearer ${'x'.repeat(42)}`]) {
    const response = await POST(new Request('https://example.test/api/push/dispatch', {
      method: 'POST', headers: { authorization },
    }));
    assert.equal(response.status, 401);
  }
  delete process.env.FIREBASE_PRIVATE_KEY;
  const response = await POST(new Request('https://example.test/api/push/dispatch', {
    method: 'POST', headers: { authorization: `Bearer ${process.env.PUSH_DISPATCH_SECRET}` },
  }));
  assert.equal(response.status, 503);
  delete process.env.PUSH_DISPATCH_SECRET;
});
