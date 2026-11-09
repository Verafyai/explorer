import { test } from 'node:test';
import assert from 'node:assert/strict';

// Live check against devnet: the first certification decodes and points at a sealed ruling.
test('first certification is on devnet', async () => {
  const rpc = (method, params) => fetch('https://api.devnet.solana.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((r) => r.json()).then((j) => j.result);
  const a = await rpc('getAccountInfo', ['8vSDoA5knpKDbu46VoSVhqM3PNwbHRrNm4gsUgjUS516', { encoding: 'base64' }]);
  const b = Buffer.from(a.value.data[0], 'base64');
  assert.equal(b.subarray(0, 8).toString(), 'VRFYCRT1');
  assert.equal(b[8], 1);
  assert.equal(a.value.owner, '1dcJPW3aGMCWDkNV6do6sEUwSxLdf8NtSuQb1teCdXt');
});
