import { prepare } from './db.js';

export const THEME_PRESETS = ['forest', 'ocean', 'sunset', 'slate', 'plum'];

export function serializeStorefrontSettings(row) {
  return {
    enabled: !!row.enabled,
    tagline: row.tagline || '',
    description: row.description || '',
    logoUrl: row.logo_url || null,
    heroImageUrl: row.hero_image_url || null,
    themePreset: row.theme_preset,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateStorefrontSettings() {
  let row = await prepare('SELECT * FROM storefront_settings LIMIT 1').get();
  if (!row) {
    await prepare('INSERT INTO storefront_settings DEFAULT VALUES').run();
    row = await prepare('SELECT * FROM storefront_settings LIMIT 1').get();
  }
  return row;
}

export async function updateStorefrontSettings(patch) {
  const existing = await getOrCreateStorefrontSettings();

  if (patch.themePreset !== undefined && !THEME_PRESETS.includes(patch.themePreset)) {
    throw new Error(`Invalid theme preset: must be one of ${THEME_PRESETS.join(', ')}`);
  }

  const enabled = patch.enabled !== undefined ? Boolean(patch.enabled) : existing.enabled;
  const tagline = patch.tagline !== undefined ? String(patch.tagline) : existing.tagline;
  const description = patch.description !== undefined ? String(patch.description) : existing.description;
  const logoUrl = patch.logoUrl !== undefined ? (patch.logoUrl || null) : existing.logo_url;
  const heroImageUrl = patch.heroImageUrl !== undefined ? (patch.heroImageUrl || null) : existing.hero_image_url;
  const themePreset = patch.themePreset !== undefined ? patch.themePreset : existing.theme_preset;

  await prepare(
    `UPDATE storefront_settings
     SET enabled = ?, tagline = ?, description = ?, logo_url = ?, hero_image_url = ?, theme_preset = ?, updated_at = ?
     WHERE id = ?`
  ).run(enabled, tagline, description, logoUrl, heroImageUrl, themePreset, new Date().toISOString(), existing.id);

  return prepare('SELECT * FROM storefront_settings LIMIT 1').get();
}
