// The old till sends a request key too (openspec/changes/sale-request-key, design 5).
// public/app.js has no modules and no browser test drives it, so this reads the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const after = (marker, n = 260) => {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `${marker} is in app.js`);
  return src.slice(at, at + n);
};

test('a sale and an order fulfilled send the sale’s key, and keep it until they succeed', () => {
  const sale = after("await api('/api/sales', {", 140);
  assert.match(sale, /requestKey: tillSaleKey/);
  assert.match(sale, /tillSaleKey = null/);
  const order = after('await api(`/api/sale-documents/${activeOrderId}/convert`', 170);
  assert.match(order, /requestKey: tillSaleKey/);
  assert.match(order, /tillSaleKey = null/);
  assert.match(src, /tillSaleKey \?\?= newSaleKey\(\);\n\s+const sale = await api\('\/api\/sales'/);
});

test('a key is long enough for the server, and a refused repeat starts afresh', () => {
  assert.match(src, /new Uint8Array\(24\)/, '48 characters; the server asks for at least 32');
  assert.match(src, /err\.code === 'reused_key'\) tillSaleKey = null/);
});

test('an order’s Convert box keeps its own key across retries', () => {
  assert.match(src, /let convertKey = null;\n\s+convertBtn\.addEventListener/);
  assert.match(after('convertKey ??= newSaleKey();', 200), /requestKey: convertKey/);
});
