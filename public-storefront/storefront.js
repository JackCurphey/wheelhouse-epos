// public-storefront/storefront.js
'use strict';

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slugFromPath() {
  const match = location.pathname.match(/^\/store\/([^/]+)/);
  return match ? match[1] : null;
}

async function api(path) {
  const slug = slugFromPath();
  const url = slug ? `${path}?storefrontSlug=${encodeURIComponent(slug)}` : path;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function applyTheme(themePreset) {
  const THEME_PRESETS = {
    forest: { topbar: '#164f42', accent: '#1f6f5c', modalBg: '#DDF7DF' },
    ocean: { topbar: '#1a3f66', accent: '#2f5f96', modalBg: '#DCEBFA' },
    sunset: { topbar: '#7a3410', accent: '#a8501e', modalBg: '#FBE8D6' },
    slate: { topbar: '#2c333a', accent: '#4a5560', modalBg: '#E6E9EC' },
    plum: { topbar: '#4a2258', accent: '#7a4a94', modalBg: '#F0E4F7' },
  };
  const preset = THEME_PRESETS[themePreset] || THEME_PRESETS.forest;
  document.documentElement.style.setProperty('--accent-dark', preset.topbar);
  document.documentElement.style.setProperty('--accent', preset.accent);
  document.documentElement.style.setProperty('--modal-bg', preset.modalBg);
}

function render(info, products) {
  const slug = slugFromPath();
  const bookHref = slug ? `/book/${slug}` : '/book';
  document.getElementById('app').innerHTML = `
    <header class="storefront-header">
      ${info.logoUrl ? `<img src="${esc(info.logoUrl)}" alt="${esc(info.shopName)} logo" />` : ''}
      <div>
        <h1>${esc(info.shopName)}</h1>
        ${info.tagline ? `<p>${esc(info.tagline)}</p>` : ''}
      </div>
    </header>
    <section class="storefront-hero">
      ${info.heroImageUrl ? `<img src="${esc(info.heroImageUrl)}" alt="" />` : ''}
      ${info.description ? `<p>${esc(info.description)}</p>` : ''}
    </section>
    <section class="product-grid">
      ${products.length ? products.map((p) => `
        <div class="product-card">
          ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="${esc(p.name)}" />` : ''}
          <h3>${esc(p.name)}</h3>
          ${p.description ? `<p>${esc(p.description)}</p>` : ''}
          <p class="price">£${p.price.toFixed(2)}</p>
          <p>Available in store</p>
        </div>
      `).join('') : '<p class="empty-state">No products listed yet.</p>'}
    </section>
    <footer class="storefront-footer">
      <a href="${esc(bookHref)}">Book a workshop slot</a>
    </footer>
  `;
}

async function boot() {
  try {
    const [info, products] = await Promise.all([api('/api/storefront/info'), api('/api/storefront/products')]);
    applyTheme(info.themePreset);
    render(info, products);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state">This storefront isn't available right now.</div>`;
  }
}

boot();
