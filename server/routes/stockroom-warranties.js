// Settings › Stockroom › Bike warranties' server (openspec/changes/finish-customers, design 6;
// Jack, 9 Nov, answer 3): bike brands, each with Frame, Components and Electronics lines, and a
// model's own lines in place of its brand's (question 17). Reading is for anyone signed in, as a
// product's page and a bike's Edit need it; changing is the Owner's, as categories are.
// Staff routes: they run with the shop's row-level security already bound.
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { notOwnerHere } from '../lib/product-editor.js';
import { bikeKinds } from '../lib/bikes.js';
import { brandSent, brandWarranties, linesSent, productWarranty, writeLines } from '../lib/warranties.js';

const CHANGE = 'Only the shop’s owner can change bike warranties';
const asId = (v) => (Number.isSafeInteger(v) && v > 0 && v <= 2147483647 ? v : null);

// In a transaction: [status, body], rolled back unless 2xx. A brand listed twice at once is a 409.
async function inTransaction(res, fn) {
  await dbExec('BEGIN');
  try {
    const [status, body] = await fn();
    await dbExec(status < 300 ? 'COMMIT' : 'ROLLBACK');
    return sendJson(res, status, body);
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    if (err.code === '23505') return sendJson(res, 409, { error: 'That brand is already listed' });
    throw err;
  }
}

async function listedAs(brand, notId = 0) {
  return prepare('SELECT brand FROM bike_brand_warranties WHERE brand_key = lower(btrim(?)) AND id <> ?').get(brand, notId);
}

// The brand and lines sent: { brand, lines } or { problem }.
function sent(body) {
  const brand = brandSent(body.brand);
  if (brand.problem) return brand;
  const lines = linesSent(body.lines);
  if (lines.problem) return lines;
  return { brand: brand.brand, lines: lines.lines };
}

export function register(route) {
  route('GET', '/api/bike-warranties', async (req, res) => {
    sendJson(res, 200, { brands: await brandWarranties() });
  });

  route('POST', '/api/bike-warranties', async (req, res) => {
    if (await notOwnerHere(req, res, CHANGE)) return;
    const body = sent((await readJsonBody(req)) ?? {});
    if (body.problem) return badRequest(res, body.problem);
    return inTransaction(res, async () => {
      const clash = await listedAs(body.brand);
      if (clash) return [409, { error: `${clash.brand} is already listed` }];
      const id = (await prepare('INSERT INTO bike_brand_warranties (brand) VALUES (?) RETURNING id').get(body.brand)).id;
      await writeLines({ brandWarrantyId: id }, body.lines);
      return [201, (await brandWarranties(id))[0]];
    });
  });

  route('PUT', '/api/bike-warranties/:id', async (req, res, params) => {
    if (await notOwnerHere(req, res, CHANGE)) return;
    const id = asId(Number(params.id));
    const body = sent((await readJsonBody(req)) ?? {});
    if (body.problem) return badRequest(res, body.problem);
    return inTransaction(res, async () => {
      if (!id || !(await prepare('SELECT id FROM bike_brand_warranties WHERE id = ? FOR UPDATE').get(id))) return [404, { error: 'Brand not found' }];
      const clash = await listedAs(body.brand, id);
      if (clash) return [409, { error: `${clash.brand} is already listed` }];
      await prepare('UPDATE bike_brand_warranties SET brand = ? WHERE id = ?').run(body.brand, id);
      await writeLines({ brandWarrantyId: id }, body.lines);
      return [200, (await brandWarranties(id))[0]];
    });
  });

  // A model's own lines (question 17): a list replaces its brand's; null puts its brand's back.
  route('PUT', '/api/products/:id/warranty', async (req, res, params) => {
    if (await notOwnerHere(req, res, CHANGE)) return;
    const id = asId(Number(params.id));
    const body = (await readJsonBody(req)) ?? {};
    const lines = body.lines === null ? { lines: [] } : linesSent(body.lines);
    if (lines.problem) return badRequest(res, lines.problem);
    // An empty list would read back as its brand's lines, so it's refused rather than saved as that.
    if (body.lines !== null && lines.lines.length === 0) return badRequest(res, 'Choose at least one line, or use the brand’s lines');
    if (!id) return notFound(res, 'Product not found');
    return inTransaction(res, async () => {
      const product = await prepare('SELECT id, brand, category FROM products WHERE id = ? FOR UPDATE').get(id);
      if (!product) return [404, { error: 'Product not found' }];
      await writeLines({ productId: id }, lines.lines);
      return [200, { warranty: await productWarranty(product, await bikeKinds()) }];
    });
  });
}
