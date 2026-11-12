// Settings › Front desk › Till › Quick buttons, in a real browser against the
// real server (openspec/changes/owner-setup-till-payments-eod task 2.1;
// set-till-quick, set-till-quick-add, set-till-quick-saved, set-till-empty).
// A new shop sees "No quick buttons yet"; the Owner adds the Workshop group's
// buttons, hovers a row for Edit and Remove, moves one with the arrow keys,
// adds the brake pads, removes a button and puts it back with Undo. On a
// phone the rows and pills wrap. Example data from the drawings.
import '../../server/load-env.js';
import { test, expect } from './fixtures.js';
import { startLiveServer } from '../helpers/liveServer.js';
import { staffSignup, staffRequest } from '../helpers/staff.js';
import { deleteTestShop } from '../helpers/testShop.js';

let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
const owners: { cookie: string; shop: { id: number } }[] = [];

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  server = await startLiveServer();
});
test.afterAll(async () => {
  try {
    for (const o of owners) await deleteTestShop(o.shop.id);
  } finally {
    if (server) await server.stop();
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`set up the till's quick buttons at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const owner = await staffSignup(server!.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
    owners.push(owner);
    const api = (path: string, body?: object) => staffRequest(server!.baseUrl, owner.cookie, path, body ? { method: 'POST', body } : {});
    for (const s of [{ name: 'Standard service', price: 65, minutes: 60 }, { name: 'Fit & adjust brakes', price: 18, minutes: 30 }, { name: 'Replace gear cable', price: 12 }]) {
      expect((await api('/api/workshop-services', { ...s, kind: 'individual' })).status).toBe(201);
    }
    expect((await api('/api/products', { name: 'Shimano brake pads B05S-RX', price: 28, cost: 14, stockQty: 6 })).status).toBe(201);

    const [cookieName, value] = owner.cookie.split('=');
    await context.addCookies([{ name: cookieName, value, url: server!.baseUrl }]);

    // A new shop: nothing yet (set-till-empty).
    await page.goto(`${server!.baseUrl}/workshop/settings?room=front-desk`);
    const fold = page.getByRole('button', { name: /^Quick buttons/ });
    await expect(fold).toContainText('None yet');
    await expect(page.getByText('No quick buttons yet')).toBeVisible();

    // The Workshop group and its services, in the till's order.
    const group = (await api('/api/quick-button-groups', { name: 'Workshop' })).body as { id: number };
    expect((await api('/api/quick-button-groups', { name: 'Parts' })).status).toBe(201);
    const services = (await api('/api/workshop-services')).body as { id: number; name: string }[];
    for (const name of ['Standard service', 'Fit & adjust brakes', 'Replace gear cable']) {
      expect((await api('/api/quick-buttons', { groupId: group.id, serviceId: services.find((s) => s.name === name)!.id })).status).toBe(201);
    }
    await page.reload();
    await expect(fold).toContainText('Workshop, Parts');
    const rows = page.locator('[data-quick-button] [data-part="name"]');
    await expect(rows).toHaveText(['Standard service', 'Fit & adjust brakes', 'Replace gear cable']);
    const row = (name: string) => page.locator('[data-quick-button]').filter({ hasText: name });

    if (viewport.width >= 768) {
      // Hover shows Edit and Remove (set-till-quick).
      await row('Fit & adjust brakes').hover();
      await expect(page.getByRole('button', { name: 'Edit Fit & adjust brakes' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove Fit & adjust brakes' })).toBeVisible();
      const r = (await row('Fit & adjust brakes').boundingBox())!;
      expect(r.height).toBeLessThan(60);
    } else {
      // On a phone the pills wrap onto a second line, and so does a row's Edit and Remove.
      const pills = page.getByRole('group', { name: 'Quick button groups' }).getByRole('button');
      const first = (await pills.first().boundingBox())!;
      expect((await pills.last().boundingBox())!.y).toBeGreaterThanOrEqual(first.y + first.height);
      await row('Fit & adjust brakes').click({ button: 'right' });
      await expect(page.getByRole('button', { name: 'Remove Fit & adjust brakes' })).toBeVisible();
      const r = (await row('Fit & adjust brakes').boundingBox())!;
      expect(r.x + r.width).toBeLessThanOrEqual(viewport.width);
      const price = (await row('Fit & adjust brakes').locator('[data-part="price"]').boundingBox())!;
      expect((await page.getByRole('button', { name: 'Edit Fit & adjust brakes' }).boundingBox())!.y).toBeGreaterThanOrEqual(price.y + price.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    if (viewport.width < 768) {
      // A group's "…" menu fits a 375px phone.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.getByRole('button', { name: 'More for Workshop' }).click();
      const menu = (await page.getByRole('menu', { name: 'Workshop' }).boundingBox())!;
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(375);
      await expect(page.getByRole('menuitem', { name: 'Rename…' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toBeHidden();
      await page.setViewportSize(viewport);
    }

    // The up arrow on a handle moves and saves, with Undo.
    await page.getByRole('button', { name: 'Move Replace gear cable — drag, or use the arrow keys' }).press('ArrowUp');
    await expect(rows).toHaveText(['Standard service', 'Replace gear cable', 'Fit & adjust brakes']);
    const note = page.locator('[data-saved-note][role="status"]');
    await expect(note).toContainText('Saved');
    await note.getByRole('button', { name: 'Undo' }).click();
    await expect(rows).toHaveText(['Standard service', 'Fit & adjust brakes', 'Replace gear cable']);

    // Add the brake pads (set-till-quick-add, set-till-quick-saved).
    await page.getByRole('button', { name: '+ Add a button' }).click();
    const box = page.getByRole('dialog');
    await expect(box).toContainText('To the Workshop group');
    await box.getByRole('textbox', { name: 'Find a product or service' }).fill('brake pads');
    await box.getByRole('button', { name: /Shimano brake pads B05S-RX/ }).click();
    await expect(box.getByRole('textbox', { name: 'Name on the button' })).toHaveValue('Shimano brake pads B05S-RX');
    await box.getByRole('textbox', { name: 'Name on the button' }).fill('Shimano brake pads');
    await box.getByRole('button', { name: 'Add the button' }).click();
    await expect(box).toBeHidden();
    await expect(note).toContainText('Saved · Shimano brake pads added to Workshop');
    await expect(rows).toHaveText(['Standard service', 'Fit & adjust brakes', 'Replace gear cable', 'Shimano brake pads']);
    await expect(row('Shimano brake pads')).toContainText('£28.00');

    // Remove, then Undo puts it back where it was.
    await row('Fit & adjust brakes').click({ button: 'right' });
    await page.getByRole('button', { name: 'Remove Fit & adjust brakes' }).click();
    await expect(rows).toHaveText(['Standard service', 'Replace gear cable', 'Shimano brake pads']);
    await note.getByRole('button', { name: 'Undo' }).click();
    await expect(rows).toHaveText(['Standard service', 'Fit & adjust brakes', 'Replace gear cable', 'Shimano brake pads']);
    const saved = (await api('/api/quick-buttons')).body as { groups: { name: string; buttons: { name: string }[] }[] };
    expect(saved.groups[0].buttons.map((b) => b.name)).toEqual(['Standard service', 'Fit & adjust brakes', 'Replace gear cable', 'Shimano brake pads']);
  });
}
