// screens: set-till-quick, set-till-quick-add, set-till-quick-saved, set-till-empty
// Quick buttons for the till (openspec/changes/owner-setup-till-payments-eod,
// design 1; migration 131): the shop's groups, each with its buttons in order.
// Anyone signed in reads them, because the till shows them; only the Owner
// changes them, until roles are built. Staff routes: they run under the
// dispatcher's /api/ branch (server.js), so a handler gets
// (req, res, params, query, afterRelease, shopId) with the shop's row-level
// security already bound. Every change answers with the whole list.
//
// Each save follows the signing-in settings route: BEGIN, SELECT … FOR UPDATE,
// write, COMMIT. Groups are changed holding the shop's row, and a group's
// buttons holding the group's row, then every row being renumbered FOR UPDATE,
// so two moves landing at once leave positions whole (0, 1, 2…) and in order.
import { ownerOnly } from '../lib/owner-only.js';
import { dbExec, prepare } from '../db.js';
import { badRequest, readJsonBody, sendJson, ValidationError } from '../lib/http.js';

const db = { prepare, exec: dbExec };

// A service's line as the till shows it today (till-page.tsx); a product is a Part.
const serviceLine = (minutes) => (minutes ? `Labour · ${minutes} min` : 'Labour');
function serializeButton(r) {
  const product = r.product_id !== null;
  const itemName = product ? r.p_name : r.s_name;
  const pricePence = product ? r.p_pence : r.s_pence;
  return {
    id: r.id, groupId: r.group_id, productId: r.product_id, serviceId: r.service_id, label: r.label,
    name: r.label ?? itemName, itemName, kind: product ? 'product' : 'service',
    line: product ? 'Part' : serviceLine(r.s_minutes),
    price: pricePence / 100, pricePence, onSale: (product ? r.p_active : r.s_active) === 1, position: r.position,
  };
}
async function loadList() {
  const groups = await db.prepare('SELECT id, name, position FROM quick_button_groups ORDER BY position, id').all();
  const buttons = await db.prepare(`SELECT b.*, p.name AS p_name, p.price_pence AS p_pence, p.active AS p_active,
      s.name AS s_name, s.price_pence AS s_pence, s.minutes AS s_minutes, s.active AS s_active
    FROM quick_buttons b LEFT JOIN products p ON p.id = b.product_id LEFT JOIN workshop_services s ON s.id = b.service_id
    ORDER BY b.position, b.id`).all();
  return groups.map((g) => ({ ...g, buttons: buttons.filter((b) => b.group_id === g.id).map(serializeButton) }));
}

// A whole number that fits the database's integer ids.
const isId = (v) => Number.isInteger(v) && v > 0 && v <= 2147483647;
function readGroupName(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (n.length < 1 || n.length > 20) throw new ValidationError('A group’s name is 1 to 20 characters');
  return n;
}
function readLabel(label) {
  if (label === null || label === undefined) return null;
  if (typeof label !== 'string') throw new ValidationError('The name on the button is words');
  const l = label.trim();
  if (l.length > 40) throw new ValidationError('The name on the button is up to 40 characters');
  return l || null;
}
function readPosition(p) {
  if (p === undefined) return undefined;
  if (!Number.isInteger(p) || p < 0) throw new ValidationError('A position is a whole number');
  return p;
}
// Exactly one of a product or a service, the shop's own (row-level security
// hides another shop's).
async function readItem(body) {
  const hasProduct = body.productId !== undefined && body.productId !== null;
  const hasService = body.serviceId !== undefined && body.serviceId !== null;
  if (hasProduct === hasService) throw new ValidationError('Pick a product or service');
  const id = hasProduct ? body.productId : body.serviceId;
  const table = hasProduct ? 'products' : 'workshop_services';
  if (!isId(id) || !(await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id))) throw new ValidationError('Pick a product or service');
  return hasProduct ? { productId: id, serviceId: null } : { productId: null, serviceId: id };
}

// Writes 0, 1, 2… down an ordered list of ids, in one statement.
async function renumber(table, ids) {
  if (ids.length) await db.prepare(`UPDATE ${table} t SET position = o.n - 1 FROM unnest(?::int[]) WITH ORDINALITY AS o(id, n) WHERE t.id = o.id`).run(ids);
}
// Takes an id out of an order, and puts it at `at` (clamped), or last.
function placed(ids, id, at) {
  const rest = ids.filter((x) => x !== id);
  const i = at === undefined ? rest.length : Math.min(at, rest.length);
  return [...rest.slice(0, i), id, ...rest.slice(i)];
}
// A group's button ids in order, its rows held. Sorted after the lock, so a
// move that waited sees the order the one before it wrote.
async function heldButtons(groupId) {
  const rows = await db.prepare('SELECT id, position FROM quick_buttons WHERE group_id = ? FOR UPDATE').all(groupId);
  return rows.sort((a, b) => a.position - b.position || a.id - b.id).map((r) => r.id);
}
async function heldGroups(shopId) {
  // NO KEY UPDATE: group saves still queue behind each other, but a button's
  // insert (whose shop link takes KEY SHARE on this row) isn't blocked by it.
  await db.prepare('SELECT id FROM shops WHERE id = ? FOR NO KEY UPDATE').get(shopId);
  // In id order, as a button's move takes two groups, so the two can't deadlock.
  const rows = await db.prepare('SELECT id, position, lower(name) AS key FROM quick_button_groups ORDER BY id FOR UPDATE').all();
  return rows.sort((a, b) => a.position - b.position || a.id - b.id);
}

class Refused extends Error {
  constructor(status, body) { super(body.error); this.status = status; this.body = body; }
}
const TAKEN = () => new Refused(409, { error: 'There’s already a group with that name', code: 'name_taken' });

// BEGIN, the change, COMMIT, then the whole list; a refusal rolls back.
async function save(res, status, change) {
  let extra;
  await db.exec('BEGIN');
  try {
    extra = await change();
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {});
    if (err instanceof ValidationError) return badRequest(res, err.message);
    if (err instanceof Refused) return sendJson(res, err.status, err.body);
    if (err.code === '23505') return sendJson(res, 409, TAKEN().body);
    throw err;
  }
  sendJson(res, status, { ...extra, groups: await loadList() });
}

export function register(route) {
  route('GET', '/api/quick-buttons', async (req, res) => {
    sendJson(res, 200, { groups: await loadList() });
  });

  route('POST', '/api/quick-button-groups', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res)) return;
    const body = await readJsonBody(req);
    await save(res, 201, async () => {
      const name = readGroupName(body.name);
      const groups = await heldGroups(shopId);
      if (groups.some((g) => g.key === name.toLowerCase())) throw TAKEN();
      const row = await db.prepare('INSERT INTO quick_button_groups (name, position) VALUES (?, ?) RETURNING id').get(name, groups.length);
      return { id: row.id };
    });
  });

  // Rename, move, or both.
  route('PUT', '/api/quick-button-groups/:id', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res)) return;
    const id = Number(params.id);
    const body = await readJsonBody(req);
    await save(res, 200, async () => {
      const name = body.name === undefined ? undefined : readGroupName(body.name);
      const position = readPosition(body.position);
      const groups = await heldGroups(shopId);
      if (!groups.some((g) => g.id === id)) throw new Refused(404, { error: 'Not found' });
      if (name !== undefined) {
        if (groups.some((g) => g.id !== id && g.key === name.toLowerCase())) throw TAKEN();
        await db.prepare('UPDATE quick_button_groups SET name = ? WHERE id = ? RETURNING id').get(name, id);
      }
      if (position !== undefined) await renumber('quick_button_groups', placed(groups.map((g) => g.id), id, position));
    });
  });

  route('DELETE', '/api/quick-button-groups/:id', async (req, res, params, query, afterRelease, shopId) => {
    if (await ownerOnly(req, res)) return;
    const id = Number(params.id);
    await save(res, 200, async () => {
      const groups = await heldGroups(shopId);
      if (!groups.some((g) => g.id === id)) throw new Refused(404, { error: 'Not found' });
      const count = (await heldButtons(id)).length;
      if (count > 0 && query.get('confirm') !== '1') {
        throw new Refused(409, { error: `This group has ${count} button${count === 1 ? '' : 's'}`, code: 'has_buttons', count });
      }
      await db.prepare('DELETE FROM quick_button_groups WHERE id = ?').run(id);
      await renumber('quick_button_groups', groups.map((g) => g.id).filter((g) => g !== id));
    });
  });

  // Last in its group, or at `position` (Undo puts a removed button back there).
  route('POST', '/api/quick-buttons', async (req, res) => {
    if (await ownerOnly(req, res)) return;
    const body = await readJsonBody(req);
    await save(res, 201, async () => {
      const item = await readItem(body);
      const label = readLabel(body.label);
      const position = readPosition(body.position);
      if (!isId(body.groupId) || !(await db.prepare('SELECT id FROM quick_button_groups WHERE id = ? FOR UPDATE').get(body.groupId))) {
        throw new ValidationError('Choose a group');
      }
      const ids = await heldButtons(body.groupId);
      const row = await db.prepare('INSERT INTO quick_buttons (group_id, product_id, service_id, label, position) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .get(body.groupId, item.productId, item.serviceId, label, ids.length);
      await renumber('quick_buttons', placed(ids, row.id, position));
      return { id: row.id };
    });
  });

  // Its item, label, group or position; what isn't sent is kept.
  route('PUT', '/api/quick-buttons/:id', async (req, res, params) => {
    if (await ownerOnly(req, res)) return;
    const id = Number(params.id);
    const body = await readJsonBody(req);
    await save(res, 200, async () => {
      const changesItem = 'productId' in body || 'serviceId' in body;
      const item = changesItem ? await readItem(body) : null;
      const label = 'label' in body ? readLabel(body.label) : undefined;
      const position = readPosition(body.position);
      const now = await db.prepare('SELECT group_id FROM quick_buttons WHERE id = ?').get(id);
      if (!now) throw new Refused(404, { error: 'Not found' });
      const to = body.groupId === undefined ? now.group_id : body.groupId;
      // Both groups' rows, in id order, so two moves between them can't deadlock.
      const groupIds = [...new Set([now.group_id, to])].sort((a, b) => a - b);
      for (const g of groupIds) {
        if (!isId(g) || !(await db.prepare('SELECT id FROM quick_button_groups WHERE id = ? FOR UPDATE').get(g))) throw new ValidationError('Choose a group');
      }
      const held = await db.prepare('SELECT * FROM quick_buttons WHERE id = ? FOR UPDATE').get(id);
      if (!held || held.group_id !== now.group_id) throw new Refused(409, { error: 'The button was just moved; try again', code: 'moved' });
      const from = await heldButtons(now.group_id);
      const into = to === now.group_id ? from : await heldButtons(to);
      await db.prepare('UPDATE quick_buttons SET group_id = ?, product_id = ?, service_id = ?, label = ? WHERE id = ? RETURNING id').get(
        to, item ? item.productId : held.product_id, item ? item.serviceId : held.service_id, label === undefined ? held.label : label, id,
      );
      if (to !== now.group_id) await renumber('quick_buttons', from.filter((x) => x !== id));
      await renumber('quick_buttons', placed(into, id, position ?? (to === now.group_id ? from.indexOf(id) : undefined)));
    });
  });

  route('DELETE', '/api/quick-buttons/:id', async (req, res, params) => {
    if (await ownerOnly(req, res)) return;
    const id = Number(params.id);
    await save(res, 200, async () => {
      const now = await db.prepare('SELECT group_id FROM quick_buttons WHERE id = ?').get(id);
      if (!now) throw new Refused(404, { error: 'Not found' });
      await db.prepare('SELECT id FROM quick_button_groups WHERE id = ? FOR UPDATE').get(now.group_id);
      const ids = await heldButtons(now.group_id);
      if (!ids.includes(id)) throw new Refused(409, { error: 'The button was just moved; try again', code: 'moved' });
      await db.prepare('DELETE FROM quick_buttons WHERE id = ?').run(id);
      await renumber('quick_buttons', ids.filter((x) => x !== id));
    });
  });
}
