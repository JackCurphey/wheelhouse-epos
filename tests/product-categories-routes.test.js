// Settings › Stockroom › Categories' server (openspec/changes/category-tree; st-categories,
// st-category-edit; stock control decision 10). Bearings with Inner diameter, Outer
// diameter and Height in mm, Drivetrain › Derailleurs with Number of gears as a choice,
// Jack Lewis and Jo Taylor as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const list = async (who = owner) => (await as(who, '/api/product-categories')).body.categories;
const find = async (path, who = owner) => (await list(who)).find((c) => c.path === path);
const make = async (name, parentId = null, who = owner) => as(who, '/api/product-categories', { method: 'POST', body: { name, parentId } });
const save = (id, body, who = owner) => as(who, `/api/product-categories/${id}`, { method: 'PUT', body });
const inShop = (fn) => runWithShop(owner.shop.id, fn);
let n = 0;
const product = async (category) => {
  n += 1;
  const res = await as(owner, '/api/products', { method: 'POST', body: { name: `[Product ${n}]`, sku: `CAT-${n}-${randomUUID().slice(0, 4)}`, category, price: 1 } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
};
const textOf = async (id) => (await inShop(() => prepare('SELECT category FROM products WHERE id = ?').get(id))).category;
const MM = (name) => ({ name, kind: 'number', unit: 'mm' });

test('adding a category, and one inside it; the list has each with its parent and path', async () => {
  const drivetrain = await make('Drivetrain');
  assert.equal(drivetrain.status, 201, JSON.stringify(drivetrain.body));
  const derailleurs = await make('Derailleurs', drivetrain.body.id);
  assert.equal(derailleurs.status, 201, JSON.stringify(derailleurs.body));
  const got = await find('Drivetrain › Derailleurs');
  assert.deepEqual([got.name, got.parentId, got.products, got.details], ['Derailleurs', drivetrain.body.id, 0, []]);
});

test('Bearings with its three details in mm, and Derailleurs with a choice', async () => {
  const bearings = (await make('Bearings')).body;
  const res = await save(bearings.id, { details: [MM('Inner diameter'), MM('Outer diameter'), MM('Height')] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await find('Bearings')).details.map((d) => [d.name, d.kind, d.unit, d.answered]),
    [['Inner diameter', 'number', 'mm', 0], ['Outer diameter', 'number', 'mm', 0], ['Height', 'number', 'mm', 0]]);
  const derailleurs = await find('Drivetrain › Derailleurs');
  const gears = await save(derailleurs.id, { details: [{ name: 'Number of gears', kind: 'choice', choices: ['[n]', '[m]'] }] });
  assert.equal(gears.status, 200, JSON.stringify(gears.body));
  assert.deepEqual((await find('Drivetrain › Derailleurs')).details.map((d) => [d.name, d.kind, d.choices]), [['Number of gears', 'choice', ['[n]', '[m]']]]);
});

test('Save keeps a detail sent with its id, renames it, and removes one left out, with its answers', async () => {
  const cat = (await make(`[Keep ${randomUUID().slice(0, 4)}]`)).body;
  await save(cat.id, { details: [MM('[A]'), { name: '[B]', kind: 'text' }] });
  const [a, b] = (await find(cat.path)).details;
  const pid = await product(cat.path);
  await inShop(() => prepare('INSERT INTO product_details (product_id, detail_id, value_text) VALUES (?, ?, ?) RETURNING product_id').get(pid, b.id, '[x]'));
  assert.equal((await find(cat.path)).details[1].answered, 1, 'how many products answer it, for "Saving removes"');
  const res = await save(cat.id, { details: [{ id: a.id, name: '[A renamed]', kind: 'number', unit: 'cm' }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await find(cat.path)).details.map((d) => [d.id, d.name, d.unit]), [[a.id, '[A renamed]', 'cm']]);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM product_details WHERE product_id = ?').get(pid))).n, 0);
});

test('what a detail needs: a unit, or choices; its kind can’t change; names don’t repeat up or down the tree', async () => {
  const parent = (await make(`[Parent ${randomUUID().slice(0, 4)}]`)).body;
  const child = (await make('[Child]', parent.id)).body;
  assert.equal((await save(parent.id, { details: [MM('[Size]')] })).status, 200);
  const refused = async (body, id = child.id) => {
    const res = await save(id, body);
    assert.equal(res.status, 400, `${JSON.stringify(body)} → ${JSON.stringify(res.body)}`);
    return res.body.error;
  };
  assert.match(await refused({ details: [{ name: '[D]', kind: 'number' }] }), /unit/i);
  assert.match(await refused({ details: [{ name: '[D]', kind: 'choice', choices: [] }] }), /choice/i);
  assert.match(await refused({ details: [{ name: '[D]', kind: 'choice', choices: ['[a]', '[A]'] }] }), /twice/i);
  assert.match(await refused({ details: [{ name: '[D]', kind: 'date' }] }), /kind/i);
  assert.match(await refused({ details: [{ name: '', kind: 'text' }] }), /name/i);
  assert.match(await refused({ details: [{ name: '[d]', kind: 'text' }, { name: '[D]', kind: 'text' }] }), /twice|already/i);
  assert.match(await refused({ details: [{ name: '[size]', kind: 'text' }] }), /\[Parent .*\] already has/);
  assert.equal((await save(child.id, { details: [{ name: '[Own]', kind: 'text' }] })).status, 200);
  assert.match(await refused({ details: [MM('[Size]'), MM('[own]')] }, parent.id), /\[Child\] already has/);
  const [size] = (await find(parent.path)).details;
  assert.match(await refused({ details: [{ id: size.id, name: '[Size]', kind: 'text' }] }, parent.id), /kind/i);
  const stranger = (await make(`[Stranger ${randomUUID().slice(0, 4)}]`)).body;
  assert.equal((await save(stranger.id, { details: [{ name: '[S]', kind: 'text' }] })).status, 200);
  const [theirs] = (await find(stranger.path)).details;
  assert.match(await refused({ details: [{ id: theirs.id, name: '[S]', kind: 'text' }] }), /isn’t one of/);
  assert.deepEqual((await find(`${parent.path} › [Child]`)).details.map((d) => d.name), ['[Own]'], 'nothing refused was kept');
});

test('a name: not empty, no ›, up to 60 characters, and not one already beside it, whatever its case', async () => {
  const p = (await make(`[Names ${randomUUID().slice(0, 4)}]`)).body;
  assert.equal((await make('[Taken]', p.id)).status, 201);
  for (const [name, why] of [['', /name/i], ['[A] › [B]', /›/], ['x'.repeat(61), /60/]]) {
    const res = await make(name, p.id);
    assert.equal(res.status, 400, name);
    assert.match(res.body.error, why);
  }
  const clash = await make('[taken]', p.id);
  assert.equal(clash.status, 409);
  assert.equal(clash.body.error, `There’s already a category called [Taken] in ${p.name}`);
  assert.equal((await make('[Taken]')).status, 201, 'the same name elsewhere is another category');
  assert.equal((await make('[Child of nothing]', 999999999)).status, 400);
});

test('renaming a category renames its path, those inside it, and every product’s text in them', async () => {
  const top = (await make(`[Old ${randomUUID().slice(0, 4)}]`)).body;
  const inner = (await make('[Inner]', top.id)).body;
  const a = await product(top.path);
  const b = await product(inner.path);
  const elsewhere = await product(`${top.path}x`);
  const res = await save(top.id, { name: '[New name]' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await textOf(a), '[New name]');
  assert.equal(await textOf(b), '[New name] › [Inner]');
  assert.equal(await textOf(elsewhere), `${top.path}x`, 'a category whose name only starts the same is left');
  assert.ok(await find('[New name] › [Inner]'));
  assert.ok((await find(top.path)) === undefined);
});

test('moving a category takes those inside it and their products; it can’t go inside itself', async () => {
  const from = (await make(`[From ${randomUUID().slice(0, 4)}]`)).body;
  const moving = (await make('[Moving]', from.id)).body;
  const under = (await make('[Under]', moving.id)).body;
  const to = (await make(`[To ${randomUUID().slice(0, 4)}]`)).body;
  const pid = await product(under.path);
  assert.equal((await save(moving.id, { parentId: under.id })).status, 400);
  assert.equal((await save(moving.id, { parentId: moving.id })).status, 400);
  const res = await save(moving.id, { parentId: to.id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await textOf(pid), `${to.path} › [Moving] › [Under]`);
  assert.equal((await save(moving.id, { parentId: null })).status, 200, 'to the top');
  assert.equal(await textOf(pid), '[Moving] › [Under]');
});

test('renaming onto a name already beside it is refused, and nothing changes', async () => {
  const p = (await make(`[Clash ${randomUUID().slice(0, 4)}]`)).body;
  const x = (await make('[X]', p.id)).body;
  await make('[Y]', p.id);
  const pid = await product(x.path);
  const res = await save(x.id, { name: '[y]' });
  assert.equal(res.status, 409);
  assert.equal(await textOf(pid), x.path);
});

test('a count running on a category stops it being renamed or moved, and says which', async () => {
  const cat = (await make(`[Counted ${randomUUID().slice(0, 4)}]`)).body;
  const inner = (await make('[In it]', cat.id)).body;
  await product(inner.path);
  const take = await as(owner, '/api/stock-takes', { method: 'POST', body: { kind: 'category', target: inner.path } });
  assert.equal(take.status, 201, JSON.stringify(take.body));
  const res = await save(cat.id, { name: '[Renamed]' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, `${inner.path} is being counted. Apply that count first.`);
  assert.equal((await save(cat.id, { details: [{ name: '[Fine]', kind: 'text' }] })).status, 200, 'its details can still change');
});

test('Owner only to change; anyone signed in reads; another business sees none and can’t reach them', async () => {
  const cat = (await make(`[Owner's ${randomUUID().slice(0, 4)}]`)).body;
  assert.equal((await make('[Jo’s]', null, jo)).status, 403);
  assert.equal((await save(cat.id, { name: '[Jo’s]' }, jo)).status, 403);
  assert.ok((await list(jo)).some((c) => c.id === cat.id), 'staff read it');
  assert.equal((await list(other)).length, 0);
  assert.equal((await save(cat.id, { name: '[Theirs]' }, other)).status, 404);
  assert.equal((await make('[Inside theirs]', cat.id, other)).status, 400);
  assert.equal((await as(owner, '/api/product-categories', { method: 'GET' })).status, 200);
});

test('each category says how many products are in it', async () => {
  const cat = (await make(`[Counted products ${randomUUID().slice(0, 4)}]`)).body;
  await product(cat.path);
  await product(cat.path);
  assert.equal((await find(cat.path)).products, 2);
});

test('a save waits at most its limit for a held category, then answers busy and changes nothing', async () => {
  const cat = (await make(`[Held ${randomUUID().slice(0, 4)}]`)).body;
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM product_categories WHERE id = $1 FOR UPDATE', [cat.id]);
    const started = Date.now();
    const res = await Promise.race([save(cat.id, { name: '[Changed]' }), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
    const waited = Date.now() - started;
    await holder.query('ROLLBACK');
    assert.equal(res.status, 503, JSON.stringify(res.body));
    assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
    assert.ok(await find(cat.path));
  } finally {
    await holder.query('ROLLBACK').catch(() => {});
    holder.release();
  }
});
