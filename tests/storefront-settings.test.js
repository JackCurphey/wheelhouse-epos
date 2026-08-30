// tests/storefront-settings.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { getOrCreateStorefrontSettings, updateStorefrontSettings, serializeStorefrontSettings } from '../server/storefront.js';

test('getOrCreateStorefrontSettings creates a default row on first access', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const row = await getOrCreateStorefrontSettings();
      assert.equal(row.enabled, false);
      assert.equal(row.theme_preset, 'forest');

      const again = await getOrCreateStorefrontSettings();
      assert.equal(again.id, row.id, 'second call should not create a second row');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('updateStorefrontSettings persists a partial patch', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await getOrCreateStorefrontSettings();
      const updated = await updateStorefrontSettings({ enabled: true, tagline: 'Bikes done right' });
      assert.equal(updated.enabled, true);
      assert.equal(updated.tagline, 'Bikes done right');
      assert.equal(updated.theme_preset, 'forest', 'unspecified fields should be untouched');

      const serialized = serializeStorefrontSettings(updated);
      assert.deepEqual(Object.keys(serialized).sort(), ['description', 'enabled', 'heroImageUrl', 'logoUrl', 'tagline', 'themePreset', 'updatedAt'].sort());
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('updateStorefrontSettings rejects an unknown theme preset', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await getOrCreateStorefrontSettings();
      await assert.rejects(
        () => updateStorefrontSettings({ themePreset: 'not-a-real-preset' }),
        /Invalid theme preset/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
