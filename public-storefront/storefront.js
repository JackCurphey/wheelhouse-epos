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

let shopifyCart = { id: null, checkoutUrl: null, lineCount: 0 };

async function shopifyStorefrontQuery(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data;
}

async function addToShopifyCart(domain, token, variantId, quantity = 1) {
  const merchandiseId = `gid://shopify/ProductVariant/${variantId}`;
  const query = shopifyCart.id
    ? `mutation($cartId: ID!, $lines: [CartLineInput!]!) {
         cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id checkoutUrl lines(first: 100) { edges { node { id } } } } userErrors { field message } }
       }`
    : `mutation($lines: [CartLineInput!]!) {
         cartCreate(input: { lines: $lines }) { cart { id checkoutUrl lines(first: 100) { edges { node { id } } } } userErrors { field message } }
       }`;
  const variables = shopifyCart.id
    ? { cartId: shopifyCart.id, lines: [{ merchandiseId, quantity }] }
    : { lines: [{ merchandiseId, quantity }] };

  const data = await shopifyStorefrontQuery(domain, token, query, variables);
  const result = shopifyCart.id ? data.cartLinesAdd : data.cartCreate;
  // Shopify reports common, expected failures (e.g. "this item isn't
  // available for purchase") via userErrors with cart: null, not via the
  // top-level `errors` array shopifyStorefrontQuery already checks (that one
  // is for malformed queries). Without this check, a userErrors failure
  // would fall through to `result.cart.id` and throw an unhelpful
  // "Cannot read properties of null" instead of a real message.
  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(result.userErrors.map((e) => e.message).join(', '));
  }
  const cart = result.cart;
  shopifyCart = { id: cart.id, checkoutUrl: cart.checkoutUrl, lineCount: cart.lines.edges.length };
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  badge.textContent = shopifyCart.lineCount > 0 ? `Cart (${shopifyCart.lineCount})` : '';
  badge.style.display = shopifyCart.lineCount > 0 ? 'inline-block' : 'none';
  badge.onclick = () => { if (shopifyCart.checkoutUrl) window.location.href = shopifyCart.checkoutUrl; };
}

function render(info, products) {
  const slug = slugFromPath();
  const bookHref = slug ? `/book/${slug}` : '/book';
  document.getElementById('app').innerHTML = `
    ${!info.enabled ? `<div class="preview-banner">Preview only — customers can't see this until you enable your storefront in settings.</div>` : ''}
    <header class="storefront-header">
      ${info.logoUrl ? `<img src="${esc(info.logoUrl)}" alt="${esc(info.shopName)} logo" />` : ''}
      <div>
        <h1>${esc(info.shopName)}</h1>
        ${info.tagline ? `<p>${esc(info.tagline)}</p>` : ''}
      </div>
      <button id="cart-badge" class="cart-badge" style="display:none;"></button>
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
          ${p.shopifyVariantId && info.shopifyDomain
            ? `<button class="buy-button" data-variant-id="${esc(p.shopifyVariantId)}">Add to cart</button>`
            : '<p>Coming soon</p>'}
        </div>
      `).join('') : '<p class="empty-state">No products listed yet.</p>'}
    </section>
    <footer class="storefront-footer">
      <a href="${esc(bookHref)}">Book a workshop slot</a>
    </footer>
  `;

  document.querySelectorAll('.buy-button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Adding…';
      try {
        await addToShopifyCart(info.shopifyDomain, info.shopifyStorefrontToken, btn.dataset.variantId);
        btn.textContent = 'Added';
      } catch (err) {
        btn.textContent = 'Add to cart';
        alert(`Could not add to cart: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  });
  updateCartBadge();
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
