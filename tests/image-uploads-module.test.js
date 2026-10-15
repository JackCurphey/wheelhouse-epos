// WP-0.4: the image upload routes live with their areas (split plan §4.1): a
// product's photo in server/routes/products.js, the shop's logo and hero image
// in server/routes/website.js. They share readUploadedImage, which is in
// server/lib/uploads.js beside UPLOADS_DIR. serveUploadedImage stays in
// server.js, because the dispatcher calls it outside the route table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const defines = (source, name) =>
  new RegExp(`^(export )?((async )?function ${name}\\b|const ${name}\\b)`, 'm').test(source);

test('each image upload route is in its area\'s file', () => {
  assert.ok(read('server/routes/products.js').includes("route('POST', '/api/products/:id/photo'"));
  const website = read('server/routes/website.js');
  assert.ok(website.includes("route('POST', '/api/storefront-settings/logo'"));
  assert.ok(website.includes("route('POST', '/api/storefront-settings/hero'"));
});

test('readUploadedImage and the allowed types are in server/lib/uploads.js only', () => {
  const uploads = read('server/lib/uploads.js');
  assert.ok(/^export async function readUploadedImage\b/m.test(uploads));
  assert.ok(defines(uploads, 'ALLOWED_IMAGE_TYPES'));
  const server = read('server/server.js');
  for (const name of ['readUploadedImage', 'ALLOWED_IMAGE_TYPES', 'MAX_PRODUCT_PHOTO_BYTES', 'MAX_SHOP_IMAGE_BYTES']) {
    assert.ok(!defines(server, name), `server.js still defines ${name}`);
  }
  for (const r of ["'/api/products/:id/photo'", "'/api/storefront-settings/logo'", "'/api/storefront-settings/hero'"]) {
    assert.ok(!server.includes(`route('POST', ${r}`), `server.js still registers ${r}`);
  }
});

test('serving an uploaded image stays in server.js, outside the route table', () => {
  assert.ok(defines(read('server/server.js'), 'serveUploadedImage'));
});
