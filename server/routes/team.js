// The team (Office > Edit Shop > Office): /api/team/* and
// DELETE /api/employees/:id/permanent.
// Staff routes: they run under the dispatcher's /api/ branch (server.js), so
// a handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare } from '../db.js';
import { badRequest, notFound, nowIso, readJsonBody, sendJson } from '../lib/http.js';
import { resolveWorkingDays } from '../capacity.js';
import { parseWorkingDays } from '../workshop/jobs.js';
import { currentSession } from '../lib/session.js';
import { TeamError, attachLogin, attachRoles, createTeamMember, deactivateLoginOnly, deactivateTeamMember, listTeam, reactivateLoginOnly, reactivateTeamMember } from '../team.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// Merges the employee roster (the Employees routes, below) with
// login access - see server/team.js for why creation is mandatory-both and
// deactivate/reactivate cascade to the linked login. Every route here needs
// to know if the caller is the owner, so each re-resolves the session itself
// via currentSession(req), same as the other routes that need more than just
// "signed in".

// ---------- Employees ----------
// A single roster shared by the Workshop (mechanics) and the Till
// (Staff): every mechanic is an employee, but not every employee is a
// mechanic (or Staff) - isMechanic/isCashier are independent flags on
// the same person.

function serializeEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    isMechanic: !!row.is_mechanic,
    isCashier: !!row.is_cashier,
    workingDays: parseWorkingDays(row.working_days),
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function register(route) {
  route('GET', '/api/team', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    sendJson(res, 200, await listTeam(ctx.shop.id));
  });

  route('POST', '/api/team', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can add team members' });
    const body = await readJsonBody(req);
    try {
      const member = await createTeamMember({
        shopId: ctx.shop.id,
        name: body.name,
        isMechanic: body.isMechanic,
        isCashier: body.isCashier,
        workingDays: body.workingDays,
        email: body.email,
        password: body.password,
      });
      sendJson(res, 201, member);
    } catch (err) {
      if (err instanceof TeamError) return badRequest(res, err.message);
      throw err;
    }
  });

  route('POST', '/api/team/:id/deactivate', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can deactivate a team member' });
    await deactivateTeamMember({ shopId: ctx.shop.id, employeeId: Number(params.id) });
    sendJson(res, 200, { ok: true });
  });

  route('POST', '/api/team/:id/reactivate', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can reactivate a team member' });
    await reactivateTeamMember({ shopId: ctx.shop.id, employeeId: Number(params.id) });
    sendJson(res, 200, { ok: true });
  });

  // Gives an existing roster-only employee login access.
  route('POST', '/api/team/:id/attach-login', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can grant login access' });
    const body = await readJsonBody(req);
    try {
      await attachLogin({ shopId: ctx.shop.id, employeeId: Number(params.id), email: body.email, password: body.password });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (err instanceof TeamError) return badRequest(res, err.message);
      throw err;
    }
  });

  // Gives an existing login-only person (typically the owner) roster roles.
  route('POST', '/api/team/logins/:loginId/attach-roles', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can set roles' });
    const body = await readJsonBody(req);
    try {
      await attachRoles({ shopId: ctx.shop.id, loginId: Number(params.loginId), isMechanic: body.isMechanic, isCashier: body.isCashier, workingDays: body.workingDays });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (err instanceof TeamError) return badRequest(res, err.message);
      throw err;
    }
  });

  // Deactivate/reactivate for a login-only person (no roster link) - e.g. any
  // staff login created before this feature, which never had an employee row.
  route('POST', '/api/team/logins/:loginId/deactivate', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can deactivate a team member' });
    try {
      await deactivateLoginOnly({ shopId: ctx.shop.id, loginId: Number(params.loginId) });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      if (err instanceof TeamError) return badRequest(res, err.message);
      throw err;
    }
  });

  route('POST', '/api/team/logins/:loginId/reactivate', async (req, res, params) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can reactivate a team member' });
    await reactivateLoginOnly({ shopId: ctx.shop.id, loginId: Number(params.loginId) });
    sendJson(res, 200, { ok: true });
  });

  // Permanently removes the employee row itself (as opposed to the soft
  // deactivate above). Workshop jobs and sales/orders already tied to them are
  // unassigned rather than deleted or blocked by the foreign key, consistent
  // with how removing a customer/bike/product never destroys sale/job history.
  // Till sales are unassigned the same way; staff check-ins are deleted.
  route('DELETE', '/api/employees/:id/permanent', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Employee not found');
    // All or nothing: if the final delete fails (e.g. a workshop hold or a
    // requested booking still names this mechanic), nothing above it may stick.
    await db.exec('BEGIN');
    try {
      await db.prepare('UPDATE workshop_jobs SET mechanic_id = NULL WHERE mechanic_id = ?').run(id);
      await db.prepare('UPDATE sales SET cashier_id = NULL WHERE cashier_id = ?').run(id);
      await db.prepare('UPDATE sale_documents SET cashier_id = NULL WHERE cashier_id = ?').run(id);
      // Till sales stay as history, unassigned; check-ins only record that this
      // person was in, so they go with the person.
      await db.prepare('UPDATE till_sales SET employee_id = NULL WHERE employee_id = ?').run(id);
      await db.prepare('DELETE FROM staff_checkins WHERE employee_id = ?').run(id);
      await db.prepare('DELETE FROM employees WHERE id = ?').run(id);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
    sendJson(res, 200, { ok: true });
  });

  route('GET', '/api/employees', async (req, res, params, query) => {
    let sql = 'SELECT * FROM employees WHERE 1=1';
    const args = [];
    if (query.get('all') !== '1') sql += ' AND active = 1';
    const role = query.get('role');
    if (role === 'mechanic') sql += ' AND is_mechanic = 1';
    else if (role === 'cashier') sql += ' AND is_cashier = 1';
    sql += ' ORDER BY name';
    const rows = await db.prepare(sql).all(...args);
    sendJson(res, 200, rows.map(serializeEmployee));
  });

  // Name/roles/working-days only - never touches login access. See the
  // /api/team routes below for creating a person, and for deactivate/
  // reactivate, which also has to cascade to their login when they have one.
  route('PUT', '/api/employees/:id', async (req, res, params) => {
    const id = Number(params.id);
    const existing = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Employee not found');
    const body = await readJsonBody(req);
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    if (!name) return badRequest(res, 'Employee name is required');
    const isMechanic = body.isMechanic !== undefined ? (body.isMechanic ? 1 : 0) : existing.is_mechanic;
    const isCashier = body.isCashier !== undefined ? (body.isCashier ? 1 : 0) : existing.is_cashier;
    const workingDays = resolveWorkingDays(body.workingDays, existing.working_days);
    if (workingDays === null) return badRequest(res, 'workingDays must be an array of day numbers (0-6)');
    await db.prepare(
      'UPDATE employees SET name = ?, is_mechanic = ?, is_cashier = ?, working_days = ?, updated_at = ? WHERE id = ?'
    ).run(name, isMechanic, isCashier, workingDays, nowIso(), id);
    const row = await db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    sendJson(res, 200, serializeEmployee(row));
  });
}
