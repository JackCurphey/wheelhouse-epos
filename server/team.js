// The merged "Team" view under Office > Edit Shop > Office: one row per
// person, joining the employee roster (roles, working days - RLS-protected,
// no shop_id needed in queries below) with their login (email/password - not
// RLS-protected, filtered by shop_id explicitly). Either side is optional:
// an employee can have no login (roster-only, never signs in) and a login
// can have no employee (the owner's login, or anything created before this
// link existed) - both are grandfathered in as-is, never force-migrated.
import { prepare, dbExec } from './db.js';
import { AuthError, validateNewLogin, hashPassword } from './auth.js';

export class TeamError extends Error {}

function resolveWorkingDays(rawDays) {
  if (rawDays === undefined) return '[0,1,2,3,4,5,6]';
  if (!Array.isArray(rawDays)) throw new TeamError('workingDays must be an array of day numbers (0-6)');
  const days = [...new Set(rawDays.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return JSON.stringify(days.sort((a, b) => a - b));
}

function serializeTeamRow(row) {
  const employeeActive = row.employee_active === null || row.employee_active === undefined ? null : !!row.employee_active;
  const loginActive = row.login_active === null || row.login_active === undefined ? null : !!row.login_active;
  return {
    employeeId: row.employee_id ?? null,
    loginId: row.login_id ?? null,
    name: row.employee_name ?? row.login_name,
    isMechanic: !!row.is_mechanic,
    isCashier: !!row.is_cashier,
    workingDays: row.working_days ? JSON.parse(row.working_days) : null,
    isOwner: !!row.is_owner,
    email: row.email || null,
    active: (employeeActive === null ? true : employeeActive) && (loginActive === null ? true : loginActive),
  };
}

export async function listTeam(shopId) {
  const rows = await prepare(
    `SELECT * FROM (
      SELECT
        e.id AS employee_id, e.name AS employee_name, e.is_mechanic, e.is_cashier,
        e.working_days, e.active AS employee_active,
        l.id AS login_id, l.name AS login_name, l.email, l.is_owner, l.active AS login_active
      FROM employees e
      LEFT JOIN logins l ON l.employee_id = e.id AND l.shop_id = ?
      UNION ALL
      SELECT
        NULL::integer, NULL, NULL::integer, NULL::integer,
        NULL, NULL::integer,
        l.id, l.name, l.email, l.is_owner, l.active
      FROM logins l
      WHERE l.employee_id IS NULL AND l.shop_id = ?
    ) t
    ORDER BY is_owner DESC NULLS LAST, COALESCE(employee_name, login_name)`
  ).all(shopId, shopId);
  return rows.map(serializeTeamRow);
}

// Creates the employee (roles) and login (access) rows together, in one
// transaction - if the login fields are invalid, no orphan employee is left
// behind. Mandatory by design: this is the only way to add someone new, so
// every new team member always has both a role and login access from the
// start (see the Office > Edit Shop design discussion).
export async function createTeamMember({ shopId, name, isMechanic, isCashier, workingDays, email, password }) {
  name = (name || '').trim();
  if (!name) throw new TeamError('Name is required');
  const mechanic = isMechanic ? 1 : 0;
  const cashier = isCashier ? 1 : 0;
  if (!mechanic && !cashier) throw new TeamError('Select at least one role');
  const days = resolveWorkingDays(workingDays);

  let clean;
  try {
    clean = await validateNewLogin({ name, email, password });
  } catch (err) {
    if (err instanceof AuthError) throw new TeamError(err.message);
    throw err;
  }

  await dbExec('BEGIN');
  try {
    const now = new Date().toISOString();
    const empInfo = await prepare(
      'INSERT INTO employees (name, is_mechanic, is_cashier, working_days, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(name, mechanic, cashier, days, now);
    const employeeId = empInfo.lastInsertRowid;

    const loginInfo = await prepare(
      'INSERT INTO logins (shop_id, name, email, password_hash, is_owner, employee_id) VALUES (?, ?, ?, ?, false, ?)'
    ).run(shopId, clean.name, clean.email, hashPassword(password), employeeId);

    await dbExec('COMMIT');
    return serializeTeamRow({
      employee_id: employeeId,
      employee_name: name,
      is_mechanic: mechanic,
      is_cashier: cashier,
      working_days: days,
      employee_active: 1,
      login_id: loginInfo.lastInsertRowid,
      login_name: clean.name,
      email: clean.email,
      is_owner: false,
      login_active: true,
    });
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}

// Completes a roster-only employee (created before this link existed, or
// deliberately added without login access at the time) by giving them login
// access now. Refuses if they already have one, rather than silently
// replacing it.
export async function attachLogin({ shopId, employeeId, email, password }) {
  const existing = await prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!existing) throw new TeamError('Employee not found');
  const alreadyLinked = await prepare('SELECT id FROM logins WHERE employee_id = ? AND shop_id = ?').get(employeeId, shopId);
  if (alreadyLinked) throw new TeamError('This person already has login access');

  let clean;
  try {
    clean = await validateNewLogin({ name: existing.name, email, password });
  } catch (err) {
    if (err instanceof AuthError) throw new TeamError(err.message);
    throw err;
  }

  const loginInfo = await prepare(
    'INSERT INTO logins (shop_id, name, email, password_hash, is_owner, employee_id) VALUES (?, ?, ?, ?, false, ?)'
  ).run(shopId, clean.name, clean.email, hashPassword(password), employeeId);
  return loginInfo.lastInsertRowid;
}

// Completes a login-only person (typically the owner, whose login is created
// at signup with no roster entry) by giving them roster roles now.
export async function attachRoles({ shopId, loginId, isMechanic, isCashier, workingDays }) {
  const login = await prepare('SELECT * FROM logins WHERE id = ? AND shop_id = ?').get(loginId, shopId);
  if (!login) throw new TeamError('Login not found');
  if (login.employee_id) throw new TeamError('This person already has roster roles');
  const mechanic = isMechanic ? 1 : 0;
  const cashier = isCashier ? 1 : 0;
  if (!mechanic && !cashier) throw new TeamError('Select at least one role');
  const days = resolveWorkingDays(workingDays);

  await dbExec('BEGIN');
  try {
    const empInfo = await prepare(
      'INSERT INTO employees (name, is_mechanic, is_cashier, working_days, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(login.name, mechanic, cashier, days, new Date().toISOString());
    await prepare('UPDATE logins SET employee_id = ? WHERE id = ? AND shop_id = ?').run(empInfo.lastInsertRowid, loginId, shopId);
    await dbExec('COMMIT');
    return empInfo.lastInsertRowid;
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}

// Deactivates a login that has no linked employee - e.g. any staff login
// created before this link existed. Refuses the owner (can't sign out the
// only owner) and refuses a login that does have an employee link (that
// case must go through deactivateTeamMember instead, so the roster side
// gets deactivated too).
export async function deactivateLoginOnly({ shopId, loginId }) {
  const login = await prepare('SELECT * FROM logins WHERE id = ? AND shop_id = ?').get(loginId, shopId);
  if (!login) throw new TeamError('Login not found');
  if (login.is_owner) throw new TeamError("The owner login can't be deactivated");
  if (login.employee_id) throw new TeamError('This person has roster roles - deactivate them from there instead');
  await prepare('UPDATE logins SET active = false, updated_at = now() WHERE id = ? AND shop_id = ?').run(loginId, shopId);
}

export async function reactivateLoginOnly({ shopId, loginId }) {
  await prepare('UPDATE logins SET active = true, updated_at = now() WHERE id = ? AND shop_id = ?').run(loginId, shopId);
}

export async function deactivateTeamMember({ shopId, employeeId }) {
  await dbExec('BEGIN');
  try {
    const now = new Date().toISOString();
    await prepare('UPDATE employees SET active = 0, updated_at = ? WHERE id = ?').run(now, employeeId);
    await prepare('UPDATE logins SET active = false, updated_at = now() WHERE employee_id = ? AND shop_id = ?').run(employeeId, shopId);
    await dbExec('COMMIT');
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}

export async function reactivateTeamMember({ shopId, employeeId }) {
  await dbExec('BEGIN');
  try {
    const now = new Date().toISOString();
    await prepare('UPDATE employees SET active = 1, updated_at = ? WHERE id = ?').run(now, employeeId);
    await prepare('UPDATE logins SET active = true, updated_at = now() WHERE employee_id = ? AND shop_id = ?').run(employeeId, shopId);
    await dbExec('COMMIT');
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}
