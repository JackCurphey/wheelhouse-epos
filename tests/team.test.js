// tests/team.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import {
  listTeam,
  createTeamMember,
  deactivateTeamMember,
  reactivateTeamMember,
  attachLogin,
  attachRoles,
  deactivateLoginOnly,
  reactivateLoginOnly,
  TeamError,
} from '../server/team.js';

test('listTeam returns nothing for a shop with no employees or logins', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const team = await listTeam(shop.id);
      assert.deepEqual(team, []);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('createTeamMember creates a linked employee and login together', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const member = await createTeamMember({
        shopId: shop.id,
        name: 'Sam Mechanic',
        isMechanic: true,
        isCashier: false,
        email: `sam-${shop.id}@example.com`,
        password: 'password123',
      });
      assert.equal(member.name, 'Sam Mechanic');
      assert.equal(member.isMechanic, true);
      assert.equal(member.isCashier, false);
      assert.equal(member.email, `sam-${shop.id}@example.com`);
      assert.equal(member.active, true);

      const team = await listTeam(shop.id);
      assert.equal(team.length, 1);
      assert.equal(team[0].employeeId, member.employeeId);
      assert.equal(team[0].loginId, member.loginId);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('createTeamMember rejects a person with no role selected', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(
        () =>
          createTeamMember({
            shopId: shop.id,
            name: 'No Role',
            isMechanic: false,
            isCashier: false,
            email: `norole-${shop.id}@example.com`,
            password: 'password123',
          }),
        TeamError
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('createTeamMember leaves no orphan employee when login validation fails', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(() =>
        createTeamMember({
          shopId: shop.id,
          name: 'Bad Password',
          isMechanic: true,
          isCashier: false,
          email: `badpw-${shop.id}@example.com`,
          password: 'short',
        })
      );
      const rows = await prepare('SELECT * FROM employees WHERE name = ?').all('Bad Password');
      assert.equal(rows.length, 0, 'the employee row should have been rolled back along with the failed login');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deactivateTeamMember deactivates the linked login too', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const member = await createTeamMember({
        shopId: shop.id,
        name: 'Cashier Casey',
        isMechanic: false,
        isCashier: true,
        email: `casey-${shop.id}@example.com`,
        password: 'password123',
      });

      await deactivateTeamMember({ shopId: shop.id, employeeId: member.employeeId });

      const team = await listTeam(shop.id);
      assert.equal(team[0].active, false);

      const { rows: [login] } = await pool.query('SELECT active FROM logins WHERE id = $1', [member.loginId]);
      assert.equal(login.active, false);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deactivateTeamMember works for an employee with no login', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const info = await prepare(
        'INSERT INTO employees (name, is_mechanic, is_cashier, updated_at) VALUES (?, ?, ?, ?)'
      ).run('Roster Only', 1, 0, new Date().toISOString());

      await deactivateTeamMember({ shopId: shop.id, employeeId: info.lastInsertRowid });

      const team = await listTeam(shop.id);
      assert.equal(team.length, 1);
      assert.equal(team[0].active, false);
      assert.equal(team[0].loginId, null);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('listTeam includes a login with no linked employee (e.g. the owner)', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await pool.query(
        'INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, $2, $3, $4, true)',
        [shop.id, 'Owner Person', `owner-${shop.id}@example.com`, 'irrelevant-hash']
      );

      const team = await listTeam(shop.id);
      assert.equal(team.length, 1);
      assert.equal(team[0].employeeId, null);
      assert.equal(team[0].name, 'Owner Person');
      assert.equal(team[0].isOwner, true);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('attachLogin gives an existing roster-only employee login access', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const info = await prepare(
        'INSERT INTO employees (name, is_mechanic, is_cashier, updated_at) VALUES (?, ?, ?, ?)'
      ).run('Legacy Mechanic', 1, 0, new Date().toISOString());
      const employeeId = info.lastInsertRowid;

      await attachLogin({
        shopId: shop.id,
        employeeId,
        email: `legacy-${shop.id}@example.com`,
        password: 'password123',
      });

      const team = await listTeam(shop.id);
      assert.equal(team.length, 1);
      assert.equal(team[0].employeeId, employeeId);
      assert.equal(team[0].email, `legacy-${shop.id}@example.com`);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('attachLogin refuses an employee that already has a login', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const member = await createTeamMember({
        shopId: shop.id,
        name: 'Already Linked',
        isMechanic: true,
        email: `already-${shop.id}@example.com`,
        password: 'password123',
      });

      await assert.rejects(
        () => attachLogin({ shopId: shop.id, employeeId: member.employeeId, email: `second-${shop.id}@example.com`, password: 'password123' }),
        TeamError
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('attachRoles gives an existing login (e.g. the owner) roster roles', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { rows: [login] } = await pool.query(
        'INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, $2, $3, $4, true) RETURNING *',
        [shop.id, 'Owner Person', `owner2-${shop.id}@example.com`, 'irrelevant-hash']
      );

      await attachRoles({ shopId: shop.id, loginId: login.id, isMechanic: true, isCashier: true });

      const team = await listTeam(shop.id);
      assert.equal(team.length, 1);
      assert.equal(team[0].isOwner, true);
      assert.equal(team[0].isMechanic, true);
      assert.equal(team[0].isCashier, true);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('attachRoles requires at least one role', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { rows: [login] } = await pool.query(
        'INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, $2, $3, $4, true) RETURNING *',
        [shop.id, 'Owner Person', `owner3-${shop.id}@example.com`, 'irrelevant-hash']
      );

      await assert.rejects(() => attachRoles({ shopId: shop.id, loginId: login.id, isMechanic: false, isCashier: false }), TeamError);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deactivateLoginOnly deactivates a legacy standalone login (no employee link)', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { rows: [login] } = await pool.query(
        'INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, $2, $3, $4, false) RETURNING *',
        [shop.id, 'Legacy Staff', `legacystaff-${shop.id}@example.com`, 'irrelevant-hash']
      );

      await deactivateLoginOnly({ shopId: shop.id, loginId: login.id });

      const team = await listTeam(shop.id);
      assert.equal(team[0].active, false);

      await reactivateLoginOnly({ shopId: shop.id, loginId: login.id });
      const teamAgain = await listTeam(shop.id);
      assert.equal(teamAgain[0].active, true);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deactivateLoginOnly refuses to deactivate the owner', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { rows: [login] } = await pool.query(
        'INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, $2, $3, $4, true) RETURNING *',
        [shop.id, 'Owner Person', `ownerprotect-${shop.id}@example.com`, 'irrelevant-hash']
      );

      await assert.rejects(() => deactivateLoginOnly({ shopId: shop.id, loginId: login.id }), TeamError);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deactivateLoginOnly refuses a login that is actually linked to an employee', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const member = await createTeamMember({
        shopId: shop.id,
        name: 'Linked Person',
        isMechanic: true,
        email: `linked-${shop.id}@example.com`,
        password: 'password123',
      });

      await assert.rejects(() => deactivateLoginOnly({ shopId: shop.id, loginId: member.loginId }), TeamError);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deleting an employee row leaves their login intact (employee_id goes to null)', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const member = await createTeamMember({
        shopId: shop.id,
        name: 'To Be Deleted',
        isMechanic: true,
        email: `todelete-${shop.id}@example.com`,
        password: 'password123',
      });

      // Mirrors DELETE /api/employees/:id/permanent in server.js.
      await prepare('DELETE FROM employees WHERE id = ?').run(member.employeeId);

      const { rows: [login] } = await pool.query('SELECT * FROM logins WHERE id = $1', [member.loginId]);
      assert.ok(login, 'the login row should still exist');
      assert.equal(login.employee_id, null);

      const teamAfter = await listTeam(shop.id);
      assert.equal(teamAfter.length, 1);
      assert.equal(teamAfter[0].employeeId, null);
      assert.equal(teamAfter[0].loginId, member.loginId);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

// ---------- Cross-shop isolation for the login-side writes ----------
// `logins` is deliberately not RLS-protected (auth has to find a login
// before a shop is in scope), so every query against it must carry an
// explicit shop_id. These tests are the guard: each one drives a function
// as shop A while passing shop B's id, and asserts shop B is untouched.

async function makeStandaloneLogin(shop, label) {
  const { rows: [login] } = await pool.query(
    'INSERT INTO logins (shop_id, name, email, password_hash, is_owner, active) VALUES ($1, $2, $3, $4, false, $5) RETURNING *',
    [shop.id, label, `${label}-${shop.id}@example.com`, 'irrelevant-hash', true]
  );
  return login;
}

async function loginById(id) {
  const { rows: [row] } = await pool.query('SELECT * FROM logins WHERE id = $1', [id]);
  return row;
}

test('deactivateLoginOnly refuses a login belonging to another shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    const victim = await makeStandaloneLogin(shopB, 'victim');

    await runWithShop(shopA.id, async () => {
      await assert.rejects(() => deactivateLoginOnly({ shopId: shopA.id, loginId: victim.id }), TeamError);
    });

    assert.equal((await loginById(victim.id)).active, true, "another shop's login was deactivated");
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('reactivateLoginOnly leaves a login belonging to another shop deactivated', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    const victim = await makeStandaloneLogin(shopB, 'lockedout');
    await pool.query('UPDATE logins SET active = false WHERE id = $1', [victim.id]);

    await runWithShop(shopA.id, async () => {
      await reactivateLoginOnly({ shopId: shopA.id, loginId: victim.id });
    });

    assert.equal((await loginById(victim.id)).active, false, "another shop's login was re-enabled");
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('attachRoles refuses a login belonging to another shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    const victim = await makeStandaloneLogin(shopB, 'roleless');

    await runWithShop(shopA.id, async () => {
      await assert.rejects(
        () => attachRoles({ shopId: shopA.id, loginId: victim.id, isMechanic: true, isCashier: false }),
        TeamError
      );
    });

    assert.equal((await loginById(victim.id)).employee_id, null, "another shop's login was given roster roles");
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('deactivateTeamMember does not touch a login in another shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    let victimLoginId;
    await runWithShop(shopB.id, async () => {
      const member = await createTeamMember({
        shopId: shopB.id,
        name: 'Shop B Mechanic',
        isMechanic: true,
        isCashier: false,
        email: `shopb-mech-${shopB.id}@example.com`,
        password: 'password123',
      });
      victimLoginId = member.loginId;
    });
    const victimEmployeeId = (await loginById(victimLoginId)).employee_id;

    await runWithShop(shopA.id, async () => {
      await deactivateTeamMember({ shopId: shopA.id, employeeId: victimEmployeeId });
    });

    assert.equal((await loginById(victimLoginId)).active, true, "another shop's login was deactivated");
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('reactivateTeamMember does not touch a login in another shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    let victimLoginId;
    await runWithShop(shopB.id, async () => {
      const member = await createTeamMember({
        shopId: shopB.id,
        name: 'Shop B Cashier',
        isMechanic: false,
        isCashier: true,
        email: `shopb-cash-${shopB.id}@example.com`,
        password: 'password123',
      });
      victimLoginId = member.loginId;
      await deactivateTeamMember({ shopId: shopB.id, employeeId: member.employeeId });
    });
    const victimEmployeeId = (await loginById(victimLoginId)).employee_id;

    await runWithShop(shopA.id, async () => {
      await reactivateTeamMember({ shopId: shopA.id, employeeId: victimEmployeeId });
    });

    assert.equal((await loginById(victimLoginId)).active, false, "another shop's login was re-enabled");
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test.after(async () => {
  await pool.end();
});
