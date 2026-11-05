// Settings › Stockroom › Categories' server (openspec/changes/category-tree; st-categories,
// st-category-edit; stock control decision 10). The screens are WP-1.5 piece 8. Reading is
// for anyone signed in, as a product's form will need it; changing is the Owner's until
// "Can order stock" (decision 11, the 5 Oct later change; roles are WP-1.1).
// Staff routes: they run with the shop's row-level security already bound.
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { JOIN } from '../lib/categories.js';
import { limitLockWait } from '../lib/stock.js';

const db = { prepare, exec: dbExec };
const CHANGE = 'Only the shop’s owner can change categories';
const MAX_NAME = 60;
const MAX_DETAILS = 50;
const MAX_UNIT = 12;
const MAX_CHOICES = 50;
const MAX_CHOICE = 40;
const KINDS = ['number', 'choice', 'text'];

const same = (a, b) => a.toLocaleLowerCase('en-GB') === b.toLocaleLowerCase('en-GB');
const asId = (v) => (Number.isSafeInteger(v) && v > 0 && v <= 2147483647 ? v : null);

// A category's name: why it can't be, or null.
function nameProblem(name) {
  if (typeof name !== 'string' || !name.trim()) return 'A category needs a name';
  if (name.includes('›')) return 'A category’s name can’t have › in it';
  if (name.trim().length > MAX_NAME) return `A category’s name can be up to ${MAX_NAME} characters`;
  return null;
}

// Each category, oldest path first, with its own details and how many products are in it
// and answer each detail ("Saving removes [Detail] from [n] products", st-category-edit).
async function categories(only = null) {
  const rows = await db.prepare(`SELECT id, name, parent_id, path FROM product_categories ${only ? 'WHERE id = ?' : ''} ORDER BY path`).all(...(only ? [only] : []));
  if (rows.length === 0) return [];
  const details = await db.prepare(
    `SELECT d.id, d.category_id, d.name, d.kind, d.unit, d.choices,
            (SELECT count(*)::int FROM product_details a WHERE a.detail_id = d.id) AS answered
       FROM category_details d WHERE d.category_id = ANY(?::int[]) ORDER BY d.position, d.id`
  ).all(rows.map((r) => r.id));
  const counts = new Map((await db.prepare('SELECT category, count(*)::int AS n FROM products WHERE category = ANY(?::text[]) GROUP BY category')
    .all(rows.map((r) => r.path))).map((r) => [r.category, r.n]));
  return rows.map((r) => ({
    id: r.id, name: r.name, parentId: r.parent_id, path: r.path, products: counts.get(r.path) ?? 0,
    details: details.filter((d) => d.category_id === r.id).map((d) => ({ id: d.id, name: d.name, kind: d.kind, unit: d.unit, choices: d.choices, answered: d.answered })),
  }));
}

// The details sent with Save, checked: [{ id?, name, kind, unit?, choices? }].
function detailsSent(sent) {
  if (!Array.isArray(sent)) return { problem: 'Send the category’s details as a list' };
  if (sent.length > MAX_DETAILS) return { problem: `A category can have up to ${MAX_DETAILS} details` };
  const out = [];
  for (const d of sent) {
    if (d === null || typeof d !== 'object') return { problem: 'Send each detail with its name and kind' };
    const name = typeof d.name === 'string' ? d.name.trim() : '';
    if (!name) return { problem: 'Each detail needs a name' };
    if (name.length > MAX_NAME) return { problem: `A detail’s name can be up to ${MAX_NAME} characters` };
    if (out.some((o) => same(o.name, name))) return { problem: `${name} is there twice` };
    if (!KINDS.includes(d.kind)) return { problem: `Say what kind of answer ${name} takes` };
    const id = d.id === undefined || d.id === null ? null : asId(d.id);
    if (d.id !== undefined && d.id !== null && id === null) return { problem: `${name} isn’t one of this category’s details` };
    let unit = null;
    let choices = [];
    if (d.kind === 'number') {
      unit = typeof d.unit === 'string' ? d.unit.trim() : '';
      if (!unit) return { problem: `Give ${name} a unit, like mm` };
      if (unit.length > MAX_UNIT) return { problem: `A unit can be up to ${MAX_UNIT} characters` };
    }
    if (d.kind === 'choice') {
      if (!Array.isArray(d.choices) || d.choices.some((c) => typeof c !== 'string')) return { problem: `Give ${name} its choices` };
      choices = d.choices.map((c) => c.trim()).filter(Boolean);
      if (choices.length === 0) return { problem: `Give ${name} at least one choice` };
      if (choices.length > MAX_CHOICES) return { problem: `${name} can have up to ${MAX_CHOICES} choices` };
      if (choices.some((c) => c.length > MAX_CHOICE)) return { problem: `A choice can be up to ${MAX_CHOICE} characters` };
      const twice = choices.find((c, i) => choices.findIndex((o) => same(o, c)) !== i);
      if (twice) return { problem: `${twice} is a choice twice` };
    }
    out.push({ id, name, kind: d.kind, unit, choices });
  }
  return { details: out };
}

export function register(route) {
  route('GET', '/api/product-categories', async (req, res) => {
    sendJson(res, 200, { categories: await categories() });
  });

  // + Add a category (st-categories): a name, and where it sits.
  route('POST', '/api/product-categories', async (req, res) => {
    if (await ownerOnly(req, res, CHANGE)) return;
    const body = (await readJsonBody(req)) ?? {};
    const problem = nameProblem(body.name);
    if (problem) return badRequest(res, problem);
    const name = body.name.trim();
    const parentId = body.parentId === undefined || body.parentId === null ? null : asId(body.parentId);
    if (body.parentId !== undefined && body.parentId !== null && parentId === null) return badRequest(res, 'Choose where it sits');
    await db.exec('BEGIN');
    try {
      await limitLockWait();
      // The parent held against a rename, as categoryFor holds what it finds.
      const parent = parentId ? await db.prepare('SELECT id, name, path FROM product_categories WHERE id = ? FOR KEY SHARE').get(parentId) : null;
      if (parentId && !parent) {
        await db.exec('ROLLBACK');
        return badRequest(res, 'Choose where it sits');
      }
      const clash = await db.prepare(`SELECT name FROM product_categories WHERE parent_id IS NOT DISTINCT FROM ? AND lower(name) = lower(?)`).get(parentId, name);
      if (clash) {
        await db.exec('ROLLBACK');
        return sendJson(res, 409, { error: `There’s already a category called ${clash.name}${parent ? ` in ${parent.name}` : ''}` });
      }
      const path = parent ? `${parent.path}${JOIN}${name}` : name;
      const made = await db.prepare('INSERT INTO product_categories (parent_id, name, path) VALUES (?, ?, ?) ON CONFLICT (shop_id, path) DO NOTHING RETURNING id').get(parentId, name, path);
      if (!made) {
        await db.exec('ROLLBACK');
        return sendJson(res, 409, { error: `There’s already a category called ${name}${parent ? ` in ${parent.name}` : ''}` });
      }
      await db.exec('COMMIT');
      const [category] = await categories(made.id);
      sendJson(res, 201, category);
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      throw err;
    }
  });

  // Save (st-category-edit): its name, where it sits, and its own details as a whole
  // list. A detail sent with its id is kept, one without is added, one left out is
  // removed with its answers. Renaming or moving rewrites the paths inside it and its
  // products' text, which every old reader goes by.
  route('PUT', '/api/product-categories/:id', async (req, res, params) => {
    if (await ownerOnly(req, res, CHANGE)) return;
    const id = asId(Number(params.id));
    if (!id) return notFound(res, 'Category not found');
    const body = (await readJsonBody(req)) ?? {};
    if (body.name !== undefined) {
      const problem = nameProblem(body.name);
      if (problem) return badRequest(res, problem);
    }
    const moving = body.parentId !== undefined;
    const parentId = body.parentId === null ? null : asId(body.parentId);
    if (moving && body.parentId !== null && parentId === null) return badRequest(res, 'Choose where it sits');
    const sent = body.details === undefined ? null : detailsSent(body.details);
    if (sent?.problem) return badRequest(res, sent.problem);

    await db.exec('BEGIN');
    const refuse = async (status, error) => {
      await db.exec('ROLLBACK');
      return sendJson(res, status, { error });
    };
    try {
      await limitLockWait();
      // Every category of the business, in id order: two saves queue, and nothing
      // inside or above this one moves under it. A business has tens of them.
      const all = await db.prepare('SELECT id, name, parent_id, path FROM product_categories ORDER BY id FOR UPDATE').all();
      const byId = new Map(all.map((c) => [c.id, c]));
      const me = byId.get(id);
      if (!me) return refuse(404, 'Category not found');
      const inside = new Set([id]);
      for (let grew = true; grew;) {
        grew = false;
        for (const c of all) if (c.parent_id !== null && inside.has(c.parent_id) && !inside.has(c.id)) { inside.add(c.id); grew = true; }
      }
      const above = [];
      for (let p = me.parent_id; p !== null; p = byId.get(p).parent_id) above.push(byId.get(p));

      const name = body.name !== undefined ? body.name.trim() : me.name;
      const newParent = moving ? parentId : me.parent_id;
      if (newParent !== null && !byId.has(newParent)) return refuse(400, 'Choose where it sits');
      if (newParent !== null && inside.has(newParent)) return refuse(400, 'A category can’t sit inside itself or one of its own');
      const parent = newParent === null ? null : byId.get(newParent);
      const path = parent ? `${parent.path}${JOIN}${name}` : name;

      if (path !== me.path) {
        const clash = all.find((c) => c.id !== id && c.parent_id === newParent && same(c.name, name));
        if (clash) return refuse(409, `There’s already a category called ${clash.name}${parent ? ` in ${parent.name}` : ''}`);
        const old = all.filter((c) => inside.has(c.id)).map((c) => c.path);
        // A count of one of these goes by its text; renaming under it would lose it.
        const counted = await db.prepare(
          "SELECT target FROM stock_takes WHERE kind = 'category' AND status = 'counting' AND target = ANY(?::text[]) ORDER BY id LIMIT 1"
        ).get(old);
        if (counted) return refuse(409, `${counted.target} is being counted. Apply that count first.`);
        const moved = (p) => `${path}${p.slice(me.path.length)}`;
        // Their products, in id order as everything takes them, then each text.
        await db.prepare('SELECT id FROM products WHERE category = ANY(?::text[]) ORDER BY id FOR NO KEY UPDATE').all(old);
        await db.prepare(
          `UPDATE products p SET category = v.now FROM unnest(?::text[], ?::text[]) AS v(was, now) WHERE p.category = v.was`
        ).run(old, old.map(moved));
        await db.prepare(
          'UPDATE product_categories c SET path = v.now FROM unnest(?::text[], ?::text[]) AS v(was, now) WHERE c.path = v.was'
        ).run(old, old.map(moved));
        await db.prepare('UPDATE product_categories SET name = ?, parent_id = ? WHERE id = ?').run(name, newParent, id);
      }

      if (sent) {
        const mine = await db.prepare('SELECT id, name, kind FROM category_details WHERE category_id = ?').all(id);
        for (const d of sent.details) {
          if (d.id === null) continue;
          const kept = mine.find((m) => m.id === d.id);
          if (!kept) return refuse(400, `${d.name} isn’t one of this category’s details`);
          if (kept.kind !== d.kind) return refuse(400, `${d.name}’s kind of answer can’t change. Remove it and add it again.`);
        }
        // A name once from the top down to the bottom: above it, and anywhere inside it.
        const elsewhere = await db.prepare(
          `SELECT d.name, c.name AS category FROM category_details d JOIN product_categories c ON c.id = d.category_id
            WHERE d.category_id = ANY(?::int[]) ORDER BY d.id`
        ).all([...above.map((c) => c.id), ...[...inside].filter((c) => c !== id)]);
        for (const d of sent.details) {
          const taken = elsewhere.find((e) => same(e.name, d.name));
          if (taken) return refuse(400, `${taken.category} already has a detail called ${taken.name}`);
        }
        const keep = sent.details.filter((d) => d.id !== null).map((d) => d.id);
        await db.prepare('DELETE FROM category_details WHERE category_id = ? AND NOT (id = ANY(?::int[]))').run(id, keep);
        for (const [position, d] of sent.details.entries()) {
          if (d.id === null) {
            await db.prepare('INSERT INTO category_details (category_id, name, kind, unit, choices, position) VALUES (?, ?, ?, ?, ?::text[], ?)')
              .run(id, d.name, d.kind, d.unit, d.choices, position);
          } else {
            await db.prepare('UPDATE category_details SET name = ?, unit = ?, choices = ?::text[], position = ? WHERE id = ?')
              .run(d.name, d.unit, d.choices, position, d.id);
          }
        }
      }
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK').catch(() => {});
      if (err.code === '23505') return sendJson(res, 409, { error: 'There’s already a category or detail with that name here' });
      throw err;
    }
    const [category] = await categories(id);
    sendJson(res, 200, category);
  });
}
