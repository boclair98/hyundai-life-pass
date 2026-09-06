import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../src/api.js', import.meta.url), 'utf8')).replace(/^const API_BASE = .*;/m, "const API_BASE = '';" );
globalThis.window = { setTimeout, clearTimeout };
const { request } = await import(`data:text/javascript;base64,${Buffer.from(`${source}\nexport { request };`).toString('base64')}`);

test('a timed-out read retries once and returns real response', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { if (++calls === 1) throw new DOMException('cold start', 'TimeoutError'); return Response.json({ available: 3 }); });
  assert.deepEqual(await request('/api/test'), { available: 3 });
  assert.equal(calls, 2);
});

test('temporary gateway failures retry only once', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: '잠시 후 다시 시도' }, { status: 503 }); });
  await assert.rejects(request('/api/test'), /잠시 후/);
  assert.equal(calls, 2);
});

test('writes are never repeated after a timeout', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new DOMException('timeout', 'TimeoutError'); });
  await assert.rejects(request('/api/test', { method: 'POST', body: '{}' }), /시간이 초과/);
  assert.equal(calls, 1);
});

test('access-denied responses are not retried', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: '접근 불가' }, { status: 403 }); });
  await assert.rejects(request('/api/test'), /접근 불가/);
  assert.equal(calls, 1);
});
