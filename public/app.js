// Wheelhouse EPOS - vanilla JS front end. No build step, no framework.
'use strict';

// ---------------- State ----------------

let currentUser = null; // { id, name, email, isOwner, shopName, shopSlug } for the signed-in employee, or null before boot() resolves it
let teamLogins = []; // employee logins for this shop - loaded by renderEmployeeLogins()
let route = (location.hash || '#till').replace('#', '');
let products = [];
let categories = [];
let cart = []; // { productId, name, sku, price, qty, stockQty, category }
let discount = 0;
let cashTendered = ''; // amount tendered/applied via cash on the Tender page
let cardAmount = ''; // amount applied via card on the Tender page
const EXTRA_TENDER_TYPES = ['Cyclescheme', 'Klarna']; // extra tender types offered as small pills; will become editable later
let extraTenders = []; // active extra tenders for the current sale: { name, amount }
let receiptSale = null; // sale object shown in the post-checkout receipt modal
let activeOrderId = null; // set while the current cart is fulfilling a specific order
let shopThemePreset = 'forest'; // this shop's chosen colour scheme key - see THEME_PRESETS

let tillSearch = '';
let tillCategory = '';
let tillCustomerId = null;

let inventorySearch = '';
let inventoryCategory = '';
let inventoryShowInactive = false;
let inventorySelectedIds = new Set(); // Stockroom bulk-select, for printing several stickers at once
let labelSettings = { widthMm: 50, heightMm: 25 }; // shop's saved sticker label size - defaults here, real value loaded lazily
let labelSettingsLoaded = false;

let suppliers = [];
let catalogueItems = [];
let catalogueStatusFilter = 'new';

let purchaseOrders = [];
let poStatusFilter = '';
let poFormItems = []; // { productId, name, sku, qty, unitCost } - local line items while building/editing a draft PO
let poFormSearch = ''; // product picker search text on the PO form

let salesDateFilter = 'today';
let salesCustomerFilter = '';
let salesCashierFilter = '';
let salesList = [];
let viewedSale = null;

let dashboardData = null;
let printAgents = []; // [{deviceId, deviceName, printers}] currently checked in for this shop (see /api/print-agents)

let customers = [];
let customerSearch = '';
let customerShowInactive = false;
let customerBikes = []; // bikes belonging to whichever customer is currently in view
let customerGroups = []; // shop-wide list of groups (e.g. "Blue Light", "ACC") customers can be tagged with
let customerMessages = []; // texts sent to whichever customer is currently in view

let workshopView = 'week'; // 'week' | 'month'
let workshopWeekStart = null; // 'YYYY-MM-DD' for the Monday of the displayed week
let workshopMonthStart = null; // 'YYYY-MM-01' for the displayed month
let workshopJobs = [];
let workshopPlacing = false; // true while "Create job" is armed, waiting for a diary click
let workshopMechanicFilter = 'all'; // 'all' | 'unassigned' | mechanic id | array of mechanic ids
let workshopMechanicFilterInitialized = false; // true once the default below (every mechanic, split view) has been applied - so it only happens once, not every re-render, and a later manual choice (incl. picking "All" back) sticks
let pendingFeedJobs = []; // every pending (customer-submitted, unapproved) job shop-wide, regardless of the diary's current date range - powers the sidebar feed

let mechanics = []; // employees with isMechanic=true, active only - used by the Workshop diary
let activeCashiers = []; // employees with isCashier=true, active only - used by Front Desk
let activeCashierId = null;
let employees = []; // full roster (all roles, active + inactive per toggle) - used by Edit Workshop
let employeeShowInactive = false;
let workshopSettings = { openingTime: '09:00', closingTime: '18:00', openingDays: [0, 1, 2, 3, 4, 5, 6], fullDayThresholdMinutes: 120 };

let docStatusFilter = { quote: '', order: '' }; // '' = all, else 'open' | 'converted' | 'cancelled'
let docList = { quote: [], order: [] };
let orderFilters = { id: '', title: '', date: '', customer: '', total: '', type: '' };
let orderStateView = 'open'; // 'open' | 'complete'

let modal = null; // { type: 'product-form' | 'stock-adjust' | 'sale-detail' | 'receipt', ...payload }
let errorMessage = '';

// ---------------- Helpers ----------------

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function money(n) {
  const v = Number(n) || 0;
  return '£' + v.toFixed(2);
}

// UK-style VAT-inclusive pricing: amount already contains 20% VAT, so this
// pulls out just the VAT portion (amount - amount / 1.2).
function vatFromInclusive(amount) {
  return (Number(amount) || 0) - (Number(amount) || 0) / 1.2;
}

// Reads a File as base64, stripping the "data:<mime>;base64," prefix
// FileReader's own encoding adds - the server only wants the raw payload.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',').pop());
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    // Session expired or was signed out elsewhere mid-use - drop back to the
    // login screen instead of letting every in-flight view render an opaque
    // "Request failed (401)" error.
    currentUser = null;
    renderAuthScreen();
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let toastTimer = null;
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2600);
}

function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (_) { return iso; }
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return iso; }
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDayShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  date.setDate(date.getDate() + diff);
  return date;
}

// ---------------- Data loading ----------------

async function loadProducts() {
  products = await api('/api/products');
  categories = await api('/api/categories');
}

async function loadProductsAll() {
  products = await api(`/api/products?all=${inventoryShowInactive ? '1' : '0'}`);
  categories = await api('/api/categories');
}

// Only fetched once per session (like workshopMechanicFilterInitialized's
// guard) - by the time a user opens the sticker print modal from Stockroom,
// the real saved label size is already in hand rather than the placeholder
// default above.
async function loadLabelSettings() {
  labelSettings = await api('/api/label-settings');
  labelSettingsLoaded = true;
}

async function loadSales() {
  const params = new URLSearchParams();
  if (salesDateFilter !== 'all') params.set('date', salesDateFilter);
  if (salesCustomerFilter) params.set('customerId', salesCustomerFilter);
  if (salesCashierFilter) params.set('cashierId', salesCashierFilter);
  const qs = params.toString();
  salesList = await api(`/api/sales${qs ? '?' + qs : ''}`);
}

async function loadDashboard() {
  dashboardData = await api('/api/dashboard');
  printAgents = await api('/api/print-agents').then((r) => r.agents);
}

async function loadCustomers() {
  customers = await api(`/api/customers?all=${customerShowInactive ? '1' : '0'}`);
}

async function loadCustomerGroups() {
  customerGroups = await api('/api/customer-groups');
}

async function loadActiveCustomers() {
  customers = await api('/api/customers');
}

async function loadCustomerBikes(customerId) {
  customerBikes = customerId ? await api(`/api/customers/${customerId}/bikes`) : [];
}

async function loadCustomerMessages(customerId) {
  customerMessages = customerId ? await api(`/api/customers/${customerId}/texts`) : [];
}

async function loadWorkshopJobs(start, end) {
  workshopJobs = await api(`/api/workshop-jobs?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

// Every pending job shop-wide, not just whatever week/month is currently on
// screen - the sidebar feed needs to surface a request regardless of which
// date the diary happens to be showing.
async function loadPendingFeed() {
  pendingFeedJobs = await api('/api/workshop-jobs?status=pending');
}

async function loadMechanics() {
  mechanics = await api('/api/employees?role=mechanic');
  // Default to every mechanic shown split side by side (matches the
  // customer portal's own default) rather than the merged single-column
  // "All" view - only on first load, so it doesn't override a filter
  // already chosen this session (including deliberately picking "All" back).
  if (!workshopMechanicFilterInitialized && mechanics.length) {
    workshopMechanicFilter = mechanics.map((m) => m.id);
    workshopMechanicFilterInitialized = true;
  }
}

async function loadActiveCashiers() {
  activeCashiers = await api('/api/employees?role=cashier');
  if (activeCashierId && !activeCashiers.some((c) => c.id === activeCashierId)) {
    activeCashierId = null;
  }
}

async function loadEmployees() {
  employees = await api(`/api/employees?all=${employeeShowInactive ? '1' : '0'}`);
}

async function loadWorkshopSettings() {
  workshopSettings = await api('/api/workshop-settings');
  applyWorkshopHours(workshopSettings.openingTime, workshopSettings.closingTime);
}

async function loadSaleDocuments(kind) {
  const status = docStatusFilter[kind];
  const qs = status ? `&status=${encodeURIComponent(status)}` : '';
  docList[kind] = await api(`/api/sale-documents?kind=${kind}${qs}`);
}

// ---------------- Navigation ----------------

const TABS = [
  { id: 'till', label: 'Front Desk' },
  { id: 'office', label: 'Office' },
  { id: 'workshop', label: 'Workshop' },
];

const OFFICE_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Stockroom' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'purchase-orders', label: 'Purchase Orders' },
  { id: 'sales', label: 'Sales History' },
  { id: 'customers', label: 'Customers' },
  {
    id: 'edit-shop',
    label: 'Edit Shop',
    children: () => [
      { id: 'front-desk', label: 'Front Desk' },
      { id: 'workshop', label: 'Workshop' },
      { id: 'colours', label: 'Colours' },
      ...(currentUser && currentUser.isOwner ? [{ id: 'logins', label: 'Employee Logins' }] : []),
    ],
  },
];

window.addEventListener('hashchange', () => {
  route = (location.hash || '#till').replace('#', '');
  renderRoute();
});

function topTab() {
  return route.split('/')[0];
}

function go(tab) {
  location.hash = tab === 'office' ? 'office/dashboard' : tab;
}

// ---------------- Shell ----------------

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="topbar">
      <div class="brand"><span class="logo">🚲</span> Wheelhouse EPOS</div>
      <div class="nav" id="nav"></div>
      <div class="shop-info">${currentUser ? esc(currentUser.shopName) + ' — ' + esc(currentUser.name) : ''}</div>
      <div class="clock" id="clock"></div>
      <button class="btn btn-sm btn-ghost" id="logout-btn">Log out</button>
    </div>
    <main id="main"></main>
  `;
  renderNav();
  updateClock();
  setInterval(updateClock, 30000);
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
    currentUser = null;
    renderAuthScreen();
  });
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = TABS.map(
    (t) => `<button data-nav="${t.id}" class="${topTab() === t.id ? 'active' : ''}">${t.label}</button>`
  ).join('');
  nav.querySelectorAll('button[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.nav));
  });
}

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function renderRoute() {
  renderNav();
  const main = document.getElementById('main');
  main.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const top = topTab();
    if (top === 'till') await renderTill();
    else if (top === 'office') await renderOffice();
    else if (top === 'workshop') await renderWorkshop();
    else { location.hash = 'till'; }
  } catch (err) {
    main.innerHTML = `<div class="error-banner">Failed to load: ${esc(err.message)}</div>`;
  }
}

// ================= TILL =================

async function renderTill() {
  const sub = route.split('/')[1];
  if (sub === 'orders') {
    await renderFrontDeskOrders();
    return;
  }
  if (sub === 'tender') {
    await renderTender();
    return;
  }
  await loadProducts();
  await loadActiveCustomers();
  await loadActiveCashiers();
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="till-layout">
      <div class="till-toolbar">
        <div class="search-wrap">
          <input type="text" id="till-search" class="search-input" placeholder="Search products, SKU or scan barcode…" autocomplete="off" value="${esc(tillSearch)}" />
          <div class="search-dropdown" id="search-dropdown"></div>
        </div>
        <button class="btn" id="new-sale-btn">New sale</button>
        <button class="btn" id="view-orders-btn">Orders</button>
      </div>
      <div class="cashier-select-row">
        <span class="cashier-select-label">Cashier:</span>
        <div class="category-pills" id="cashier-pills"></div>
      </div>
      <div class="category-pills" id="till-pills"></div>
      <div class="panel cart-panel">
        <div class="panel-header"><h2>Current sale</h2></div>
        <div class="panel-body" id="cart-body"></div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('till-search');
  searchInput.addEventListener('input', (e) => {
    tillSearch = e.target.value;
    renderSearchDropdown();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const matches = getTillMatches();
      if (matches.length > 0) addToCart(matches[0].id);
    } else if (e.key === 'Escape') {
      clearTillSearch();
    }
  });
  document.getElementById('new-sale-btn').addEventListener('click', () => {
    if (cart.length && !confirm('Clear the current sale?')) return;
    resetCart();
  });
  document.getElementById('view-orders-btn').addEventListener('click', () => {
    location.hash = 'till/orders';
  });

  renderTillPills();
  renderCashierPills();
  renderSearchDropdown();
  renderCart();
}

function renderTillPills() {
  const wrap = document.getElementById('till-pills');
  if (!wrap) return;
  const cats = ['All', ...categories];
  wrap.innerHTML = cats
    .map((c) => {
      const val = c === 'All' ? '' : c;
      const active = tillCategory === val ? 'active' : '';
      return `<button class="pill ${active}" data-cat="${esc(val)}">${esc(c)}</button>`;
    })
    .join('');
  wrap.querySelectorAll('button[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tillCategory = btn.dataset.cat;
      renderTillPills();
      renderSearchDropdown();
    });
  });
}

function renderCashierPills() {
  const wrap = document.getElementById('cashier-pills');
  if (!wrap) return;
  if (!activeCashiers.length) {
    wrap.innerHTML = '<span class="muted" style="font-size:12.5px;">No cashiers added — set them up under Edit Shop &gt; Workshop.</span>';
    return;
  }
  wrap.innerHTML = activeCashiers
    .map((c) => `<button class="pill ${activeCashierId === c.id ? 'active' : ''}" data-cashier="${c.id}">${esc(c.name)}</button>`)
    .join('');
  wrap.querySelectorAll('button[data-cashier]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.cashier);
      activeCashierId = activeCashierId === id ? null : id;
      renderCashierPills();
      if (document.getElementById('cart-body')) renderCart();
    });
  });
}

function getTillMatches() {
  const term = tillSearch.trim().toLowerCase();
  if (!term) return [];
  return products.filter((p) => {
    if (tillCategory && p.category !== tillCategory) return false;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.sku || '').toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term)
    );
  });
}

const TILL_DROPDOWN_LIMIT = 8;

function renderSearchDropdown() {
  const dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;
  if (!tillSearch.trim()) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    return;
  }
  const matches = getTillMatches();
  dropdown.classList.add('open');
  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-empty">No products match.</div>';
    return;
  }
  const shown = matches.slice(0, TILL_DROPDOWN_LIMIT);
  dropdown.innerHTML =
    shown
      .map((p) => {
        const isService = p.category === 'Services';
        const outOfStock = !isService && p.stockQty <= 0;
        const low = !isService && p.stockQty <= p.lowStockThreshold;
        const stockLabel = isService ? 'Service' : `${p.stockQty} in stock`;
        return `
        <button class="search-dropdown-item" data-add="${p.id}" ${outOfStock ? 'disabled' : ''}>
          <span class="sdi-main">
            <span class="sdi-name">${esc(p.name)}</span>
            <span class="sdi-sku">${esc(p.sku || '')}</span>
          </span>
          <span class="sdi-side">
            <span class="sdi-price">${money(p.price)}</span>
            <span class="sdi-stock ${low ? 'low' : ''}">${esc(stockLabel)}${outOfStock ? ' · Out of stock' : ''}</span>
          </span>
        </button>
      `;
      })
      .join('') +
    (matches.length > TILL_DROPDOWN_LIMIT
      ? `<div class="search-dropdown-more">+${matches.length - TILL_DROPDOWN_LIMIT} more — keep typing to narrow it down</div>`
      : '');

  dropdown.querySelectorAll('button[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(Number(btn.dataset.add)));
  });
}

function clearTillSearch() {
  tillSearch = '';
  const input = document.getElementById('till-search');
  if (input) {
    input.value = '';
    input.focus();
  }
  renderSearchDropdown();
}

// Wires a text input + dropdown into a type-ahead customer picker. Used
// anywhere a customer needs attaching to something (till checkout, workshop
// jobs) instead of a plain <select> full of every customer.
function setupCustomerAutocomplete({
  inputId,
  dropdownId,
  getSelectedId,
  setSelectedId,
  onChange,
  emptyLabel = 'Walk-in / no account',
  allowCreate = true,
  onCreateNew, // optional: called instead of opening the customer-form modal
  // directly - needed when this picker already lives inside another modal,
  // since there's no modal stacking and a nested modal would wipe it out.
}) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  const currentName = () => customers.find((c) => c.id === getSelectedId())?.name || '';

  function closeDropdown() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
  }

  function renderOptions() {
    const term = input.value.trim().toLowerCase();
    const matches = term ? customers.filter((c) => c.name.toLowerCase().includes(term)) : customers;
    const shown = matches.slice(0, 8);

    let html = '';
    if (!term) {
      html += `<button type="button" class="search-dropdown-item" data-walkin="1"><span class="sdi-main"><span class="sdi-name">${esc(emptyLabel)}</span></span></button>`;
    }
    html += shown
      .map(
        (c) => `
      <button type="button" class="search-dropdown-item" data-customer="${c.id}">
        <span class="sdi-main"><span class="sdi-name">${esc(c.name)}</span></span>
      </button>
    `
      )
      .join('');
    if (term && matches.length === 0) {
      html += `<div class="search-dropdown-empty">No customers match "${esc(input.value.trim())}".</div>`;
    } else if (matches.length > shown.length) {
      html += `<div class="search-dropdown-more">+${matches.length - shown.length} more — keep typing to narrow it down</div>`;
    }
    if (allowCreate) {
      html += `<button type="button" class="search-dropdown-item" data-new="1"><span class="sdi-main"><span class="sdi-name">+ New customer…</span></span></button>`;
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('open');

    dropdown.querySelectorAll('button[data-customer]').forEach((b) => {
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        const c = customers.find((x) => x.id === Number(b.dataset.customer));
        setSelectedId(c.id);
        input.value = c.name;
        closeDropdown();
        onChange && onChange();
      });
    });
    const walkinBtn = dropdown.querySelector('button[data-walkin]');
    if (walkinBtn) {
      walkinBtn.addEventListener('mousedown', (e) => e.preventDefault());
      walkinBtn.addEventListener('click', () => {
        setSelectedId(null);
        input.value = '';
        closeDropdown();
        onChange && onChange();
      });
    }
    const newBtn = dropdown.querySelector('button[data-new]');
    if (newBtn) {
      newBtn.addEventListener('mousedown', (e) => e.preventDefault());
      newBtn.addEventListener('click', async () => {
        closeDropdown();
        if (onCreateNew) {
          onCreateNew();
          return;
        }
        await loadCustomerGroups();
        openModal({
          type: 'customer-form',
          customer: null,
          afterSave: async (saved) => {
            await loadActiveCustomers();
            setSelectedId(saved.id);
            input.value = saved.name;
            onChange && onChange();
          },
        });
      });
    }
  }

  input.addEventListener('focus', () => {
    if (input.value === currentName()) input.value = '';
    renderOptions();
  });
  input.addEventListener('input', renderOptions);
  input.addEventListener('blur', () => {
    input.value = currentName();
    closeDropdown();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = currentName();
      closeDropdown();
      input.blur();
    }
  });
}

function addToCart(productId) {
  const p = products.find((x) => x.id === productId);
  if (!p) return;
  const isService = p.category === 'Services';
  const existing = cart.find((l) => l.productId === productId);
  const currentQty = existing ? existing.qty : 0;
  if (!isService && currentQty + 1 > p.stockQty) {
    showToast(`Only ${p.stockQty} of "${p.name}" in stock`);
    return;
  }
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ productId: p.id, name: p.name, sku: p.sku, price: p.price, originalPrice: p.price, qty: 1, stockQty: p.stockQty, category: p.category });
  }
  renderCart();
  clearTillSearch();
}

function cartSubtotal() {
  return cart.reduce((sum, l) => sum + (l.originalPrice ?? l.price) * l.qty, 0);
}

function cartItemDiscountTotal() {
  return cart.reduce((sum, l) => sum + ((l.originalPrice ?? l.price) - l.price) * l.qty, 0);
}

// The automatic discount from whichever of the selected till customer's
// groups carries the highest discount_percent (mirrors resolveGroupDiscount
// in server.js, which is what actually gets charged - this is only for live
// display before the sale is submitted). netSubtotal is the subtotal after
// any per-line price overrides but before the flat/group discounts.
function tillCustomerGroupDiscount(netSubtotal) {
  const customer = customers.find((c) => c.id === tillCustomerId);
  const groups = customer?.groups || [];
  const top = groups.reduce((best, g) => (g.discountPercent > (best?.discountPercent || 0) ? g : best), null);
  if (!top || !top.discountPercent) return { percent: 0, amount: 0, name: '' };
  const amount = Math.round(netSubtotal * (top.discountPercent / 100) * 100) / 100;
  return { percent: top.discountPercent, amount, name: top.name };
}

function cartTotal() {
  const netSubtotal = cartSubtotal() - cartItemDiscountTotal();
  const groupDiscount = tillCustomerGroupDiscount(netSubtotal);
  return Math.max(0, netSubtotal - discount - groupDiscount.amount);
}

// Cash and Card each have their own always-visible amount box; whatever the
// customer is actually paying via cash can't count toward the total for
// more than the total itself (the excess is just change), while card is
// charged exactly what's in its box.
function resolvePaymentAmounts(total) {
  const cashAmount = Math.min(total, Math.max(0, parseFloat(cashTendered) || 0));
  const cardApplied = Math.max(0, parseFloat(cardAmount) || 0);
  return { cashAmount, cardAmount: cardApplied };
}

function extraTendersTotal() {
  return extraTenders.reduce((sum, t) => sum + Math.max(0, parseFloat(t.amount) || 0), 0);
}

function pctOff(original, current) {
  if (!original || current >= original) return 0;
  return Math.round((1 - current / original) * 100);
}

function resetCart() {
  cart = [];
  discount = 0;
  cashTendered = '';
  cardAmount = '';
  extraTenders = [];
  tillCustomerId = null;
  activeOrderId = null;
  clearTillSearch();
  renderCart();
}

function renderCart() {
  const body = document.getElementById('cart-body');
  if (!body) return;

  const fromOrder = !!activeOrderId;

  const linesHtml = cart.length
    ? cart
        .map((l, idx) => {
          const pct = pctOff(l.originalPrice ?? l.price, l.price);
          return `
        <div class="cart-line" data-idx="${idx}">
          <div class="info">
            <div class="name">${esc(l.name)}</div>
            <div class="unit">
              £<input type="number" class="price-input" data-price-idx="${idx}" min="0" step="0.01" value="${l.price}" /> each
              <span class="line-discount-badge" data-badge-idx="${idx}" ${pct > 0 ? '' : 'style="display:none"'}>${pct > 0 ? `−${pct}% off` : ''}</span>
            </div>
          </div>
          <div class="qty-control">
            <button data-dec="${idx}">−</button>
            <span>${l.qty}</span>
            <button data-inc="${idx}">+</button>
          </div>
          <div class="line-total">${money(l.price * l.qty)}</div>
          <button class="remove-btn" data-remove="${idx}" title="Remove">✕</button>
        </div>
      `;
        })
        .join('')
    : '<div class="empty-cart">Cart is empty.<br>Tap a product to add it.</div>';

  const bannerHtml = fromOrder
    ? `<div class="order-fulfill-banner">
        <span>Editing Order #${activeOrderId}</span>
        <button type="button" class="btn btn-sm" id="cancel-order-fulfill-btn">Cancel</button>
      </div>`
    : '';

  body.innerHTML = `
    ${bannerHtml}
    <div class="cart-split">
      <div class="cart-items-col">
        <div class="cart-items" id="cart-items">${linesHtml}</div>
      </div>
      <div class="cart-summary-col">
        <div class="field">
          <label for="customer-input">Customer</label>
          <div style="display:flex; gap:8px; align-items:flex-start;">
            <div class="search-wrap" style="flex:1;">
              <input type="text" id="customer-input" class="search-input" placeholder="Walk-in / no account" autocomplete="off" value="${esc(customers.find((c) => c.id === tillCustomerId)?.name || '')}" />
              <div class="search-dropdown" id="customer-dropdown"></div>
            </div>
            <button type="button" class="btn btn-sm" id="till-text-btn" ${tillCustomerId ? '' : 'disabled'}>Text</button>
          </div>
        </div>
        <div class="field">
          <label for="discount-input">Discount (£)</label>
          <input type="number" id="discount-input" min="0" step="0.01" value="${discount || ''}" placeholder="0.00" />
        </div>
        <table class="totals-table" id="cart-totals"></table>
        <button class="btn btn-primary btn-block" id="tender-btn" ${cart.length ? '' : 'disabled'}>Tender</button>
        <div class="cart-alt-actions">
          <button class="btn btn-sm" id="save-order-btn" ${cart.length ? '' : 'disabled'}>${fromOrder ? 'Save order' : 'Save as order'}</button>
        </div>
      </div>
    </div>
  `;

  body.querySelectorAll('input[data-price-idx]').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.priceIdx);
      const line = cart[idx];
      if (!line) return;
      line.price = Math.max(0, parseFloat(e.target.value) || 0);
      const lineEl = body.querySelector(`.cart-line[data-idx="${idx}"] .line-total`);
      if (lineEl) lineEl.textContent = money(line.price * line.qty);
      const badgeEl = body.querySelector(`.line-discount-badge[data-badge-idx="${idx}"]`);
      if (badgeEl) {
        const pct = pctOff(line.originalPrice ?? line.price, line.price);
        badgeEl.textContent = pct > 0 ? `−${pct}% off` : '';
        badgeEl.style.display = pct > 0 ? '' : 'none';
      }
      updateTotals();
    });
  });
  body.querySelectorAll('button[data-inc]').forEach((b) => b.addEventListener('click', () => changeQty(Number(b.dataset.inc), 1)));
  body.querySelectorAll('button[data-dec]').forEach((b) => b.addEventListener('click', () => changeQty(Number(b.dataset.dec), -1)));
  body.querySelectorAll('button[data-remove]').forEach((b) => b.addEventListener('click', () => {
    cart.splice(Number(b.dataset.remove), 1);
    renderCart();
  }));

  setupCustomerAutocomplete({
    inputId: 'customer-input',
    dropdownId: 'customer-dropdown',
    getSelectedId: () => tillCustomerId,
    setSelectedId: (id) => { tillCustomerId = id; },
    onChange: () => {
      updateTotals();
      updateTillTextButton();
    },
  });
  document.getElementById('till-text-btn').addEventListener('click', () => {
    const customer = customers.find((c) => c.id === tillCustomerId);
    if (customer) openModal({ type: 'customer-sms', customer });
  });
  document.getElementById('discount-input').addEventListener('input', (e) => {
    discount = Math.max(0, parseFloat(e.target.value) || 0);
    updateTotals();
  });
  document.getElementById('tender-btn').addEventListener('click', () => {
    if (!cart.length) return;
    location.hash = 'till/tender';
  });
  document.getElementById('save-order-btn').addEventListener('click', () => {
    if (fromOrder) saveLoadedOrder();
    else saveCartAsDocument('order');
  });
  const cancelBtn = document.getElementById('cancel-order-fulfill-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => resetCart());
  }

  updateTotals();
}

async function saveLoadedOrder() {
  if (!cart.length || !activeOrderId) return;
  const btn = document.getElementById('save-order-btn');
  btn.disabled = true;
  try {
    await api(`/api/sale-documents/${activeOrderId}/items`, {
      method: 'PUT',
      body: {
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.price })),
        discount,
      },
    });
    await api(`/api/sale-documents/${activeOrderId}`, { method: 'PUT', body: { customerId: tillCustomerId } });
    showToast('Order updated');
    await refreshDocListAfterChange('order');
    resetCart();
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
  }
}

// Placeholder tender/payment screen - reachable via the "Tender" button on
// Front Desk. Will get built out further; for now it just relocates the
// payment-method/cash-tendered/complete-sale step off the main cart page.
async function renderTender() {
  if (!cart.length) {
    location.hash = 'till';
    return;
  }
  await loadActiveCashiers();
  const locked = !!activeOrderId;
  const main = document.getElementById('main');
  const total = cartTotal();

  // First time landing on this page for a fresh sale, default to "all cash"
  // (matches the old single-method default) - both boxes stay editable from
  // there, and revisiting the page later keeps whatever was already entered.
  if (cashTendered === '' && cardAmount === '') {
    cashTendered = total.toFixed(2);
  }

  const bannerHtml = locked
    ? `<div class="order-fulfill-banner"><span>Fulfilling Order #${activeOrderId}</span></div>`
    : '';

  const availableExtras = EXTRA_TENDER_TYPES.filter((name) => !extraTenders.some((t) => t.name === name));

  const extraColsHtml = extraTenders
    .map(
      (t) => `
            <div class="payment-split-col">
              <button type="button" class="payment-pill payment-pill-extra" data-extra-remove="${esc(t.name)}">${esc(t.name)} <span class="payment-pill-x">✕</span></button>
              <input type="number" class="payment-amount-input" data-extra-input="${esc(t.name)}" min="0" step="0.01" value="${esc(t.amount)}" placeholder="0.00" />
            </div>`
    )
    .join('');

  const extraPillsHtml = availableExtras.length
    ? `<div class="tender-extra-pills">
        ${availableExtras.map((name) => `<button type="button" class="tender-extra-pill" data-extra-add="${esc(name)}">+ ${esc(name)}</button>`).join('')}
      </div>`
    : '';

  main.innerHTML = `
    <div class="panel cart-panel tender-panel">
      <div class="panel-header">
        <h2>Tender</h2>
        <button class="btn btn-sm" id="back-to-cart-btn">← Back to sale</button>
      </div>
      <div class="panel-body">
        ${bannerHtml}
        <div class="field">
          <label>Payment method</label>
          <div class="payment-split-row">
            <div class="payment-split-col">
              <button type="button" class="payment-pill" id="fill-cash-btn">Cash</button>
              <input type="number" id="cash-tendered" class="payment-amount-input" min="0" step="0.01" value="${cashTendered}" placeholder="0.00" />
            </div>
            <div class="payment-split-col">
              <button type="button" class="payment-pill" id="fill-card-btn">Card</button>
              <input type="number" id="card-amount" class="payment-amount-input" min="0" step="0.01" value="${cardAmount}" placeholder="0.00" />
            </div>${extraColsHtml}
          </div>
          ${extraPillsHtml}
        </div>
        <table class="totals-table" id="cart-totals"></table>
        <button class="btn btn-primary btn-block" id="complete-sale-btn" disabled>Complete sale</button>
        ${!activeCashierId ? `<p class="muted" style="margin:6px 0 0; font-size:12px; text-align:center;">Select a cashier on Front Desk to complete this sale.</p>` : ''}
      </div>
    </div>
  `;

  document.getElementById('back-to-cart-btn').addEventListener('click', () => {
    location.hash = 'till';
  });
  document.getElementById('fill-cash-btn').addEventListener('click', () => {
    cashTendered = total.toFixed(2);
    cardAmount = '0.00';
    document.getElementById('cash-tendered').value = cashTendered;
    document.getElementById('card-amount').value = cardAmount;
    updateTotals();
  });
  document.getElementById('fill-card-btn').addEventListener('click', () => {
    cardAmount = total.toFixed(2);
    cashTendered = '0.00';
    document.getElementById('cash-tendered').value = cashTendered;
    document.getElementById('card-amount').value = cardAmount;
    updateTotals();
  });
  document.getElementById('cash-tendered').addEventListener('input', (e) => {
    cashTendered = e.target.value;
    const cashApplied = Math.min(total, Math.max(0, parseFloat(cashTendered) || 0));
    const remainderForCard = Math.max(0, total - cashApplied - extraTendersTotal());
    cardAmount = remainderForCard.toFixed(2);
    document.getElementById('card-amount').value = cardAmount;
    updateTotals();
  });
  document.getElementById('card-amount').addEventListener('input', (e) => {
    cardAmount = e.target.value;
    updateTotals();
  });
  document.querySelectorAll('[data-extra-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      extraTenders.push({ name: btn.dataset.extraAdd, amount: '' });
      renderTender();
    });
  });
  document.querySelectorAll('[data-extra-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      extraTenders = extraTenders.filter((t) => t.name !== btn.dataset.extraRemove);
      renderTender();
    });
  });
  document.querySelectorAll('[data-extra-input]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const t = extraTenders.find((x) => x.name === input.dataset.extraInput);
      if (t) t.amount = e.target.value;
      updateTotals();
    });
  });
  document.getElementById('complete-sale-btn').addEventListener('click', locked ? completeOrderFulfillment : completeSale);

  updateTotals();
}

async function saveCartAsDocument(kind) {
  if (!cart.length) return;
  const payload = {
    kind,
    items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.price })),
    discount,
    customerId: tillCustomerId,
    cashierId: activeCashierId,
  };
  try {
    const doc = await api('/api/sale-documents', { method: 'POST', body: payload });
    showToast(kind === 'quote' ? 'Quote saved' : 'Order saved');
    cart = [];
    discount = 0;
    cashTendered = '';
    extraTenders = [];
    tillCustomerId = null;
    clearTillSearch();
    renderCart();
    openModal({ type: 'document-view', doc });
  } catch (err) {
    showToast(err.message);
  }
}

async function renderFrontDeskOrders() {
  docStatusFilter.order = '';
  docStatusFilter.quote = '';
  await Promise.all([loadSaleDocuments('order'), loadSaleDocuments('quote')]);
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Orders</h2>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm" id="clear-order-filters-btn">Clear filters</button>
          <button class="btn btn-sm" id="back-to-sale-btn">← Back to sale</button>
        </div>
      </div>
      <div class="panel-body">
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <button class="btn btn-sm ${orderStateView === 'open' ? 'btn-primary' : ''}" id="order-state-open-btn">Open</button>
          <button class="btn btn-sm ${orderStateView === 'complete' ? 'btn-primary' : ''}" id="order-state-complete-btn">Complete</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr><th>#</th><th>Title</th><th>Date</th><th>Customer</th><th class="num">Total</th><th>Type</th><th></th></tr>
              <tr class="filter-row">
                <th><input type="text" id="of-filter-id" class="col-filter" placeholder="Search #" value="${esc(orderFilters.id)}" /></th>
                <th><input type="text" id="of-filter-title" class="col-filter" placeholder="Search title" value="${esc(orderFilters.title)}" /></th>
                <th><input type="date" id="of-filter-date" class="col-filter" value="${esc(orderFilters.date)}" /></th>
                <th><input type="text" id="of-filter-customer" class="col-filter" placeholder="Search customer" value="${esc(orderFilters.customer)}" /></th>
                <th><input type="text" id="of-filter-total" class="col-filter" placeholder="Search total" value="${esc(orderFilters.total)}" /></th>
                <th>
                  <select id="of-filter-type" class="col-filter">
                    <option value="" ${orderFilters.type === '' ? 'selected' : ''}>All</option>
                    <option value="order" ${orderFilters.type === 'order' ? 'selected' : ''}>Order</option>
                    <option value="workshop" ${orderFilters.type === 'workshop' ? 'selected' : ''}>Workshop job</option>
                    <option value="quote" ${orderFilters.type === 'quote' ? 'selected' : ''}>Quote</option>
                  </select>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody id="order-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.getElementById('back-to-sale-btn').addEventListener('click', () => {
    location.hash = 'till';
  });
  document.getElementById('clear-order-filters-btn').addEventListener('click', () => {
    orderFilters = { id: '', title: '', date: '', customer: '', total: '', type: '' };
    document.getElementById('of-filter-id').value = '';
    document.getElementById('of-filter-title').value = '';
    document.getElementById('of-filter-date').value = '';
    document.getElementById('of-filter-customer').value = '';
    document.getElementById('of-filter-total').value = '';
    document.getElementById('of-filter-type').value = '';
    renderFrontDeskOrderTable();
  });
  document.getElementById('of-filter-id').addEventListener('input', (e) => {
    orderFilters.id = e.target.value;
    renderFrontDeskOrderTable();
  });
  document.getElementById('of-filter-title').addEventListener('input', (e) => {
    orderFilters.title = e.target.value;
    renderFrontDeskOrderTable();
  });
  document.getElementById('of-filter-date').addEventListener('change', (e) => {
    orderFilters.date = e.target.value;
    renderFrontDeskOrderTable();
  });
  document.getElementById('of-filter-customer').addEventListener('input', (e) => {
    orderFilters.customer = e.target.value;
    renderFrontDeskOrderTable();
  });
  document.getElementById('of-filter-total').addEventListener('input', (e) => {
    orderFilters.total = e.target.value;
    renderFrontDeskOrderTable();
  });
  document.getElementById('of-filter-type').addEventListener('change', (e) => {
    orderFilters.type = e.target.value;
    renderFrontDeskOrderTable();
  });
  const openStateBtn = document.getElementById('order-state-open-btn');
  const completeStateBtn = document.getElementById('order-state-complete-btn');
  openStateBtn.addEventListener('click', () => {
    orderStateView = 'open';
    openStateBtn.classList.add('btn-primary');
    completeStateBtn.classList.remove('btn-primary');
    renderFrontDeskOrderTable();
  });
  completeStateBtn.addEventListener('click', () => {
    orderStateView = 'complete';
    completeStateBtn.classList.add('btn-primary');
    openStateBtn.classList.remove('btn-primary');
    renderFrontDeskOrderTable();
  });
  renderFrontDeskOrderTable();
}

function docTypeInfo(d) {
  if (d.kind === 'quote') return { value: 'quote', label: 'Quote', cls: 'type-quote' };
  if (d.workshopJobId) return { value: 'workshop', label: 'Workshop job', cls: 'type-workshop' };
  return { value: 'order', label: 'Order', cls: 'type-order' };
}

function orderMatchesFilters(d) {
  const isComplete = d.status !== 'open';
  if (orderStateView === 'open' && isComplete) return false;
  if (orderStateView === 'complete' && !isComplete) return false;
  if (orderFilters.id.trim() && !String(d.id).includes(orderFilters.id.trim())) return false;
  if (orderFilters.title.trim() && !(d.title || '').toLowerCase().includes(orderFilters.title.trim().toLowerCase())) return false;
  if (orderFilters.date && d.createdAt.slice(0, 10) !== orderFilters.date) return false;
  if (orderFilters.customer.trim()) {
    const name = (d.customerName || 'walk-in').toLowerCase();
    if (!name.includes(orderFilters.customer.trim().toLowerCase())) return false;
  }
  if (orderFilters.total.trim() && !d.total.toFixed(2).includes(orderFilters.total.trim())) return false;
  if (orderFilters.type && docTypeInfo(d).value !== orderFilters.type) return false;
  return true;
}

function renderFrontDeskOrderTable() {
  const tbody = document.getElementById('order-table-body');
  if (!tbody) return;
  const combined = [...docList.order, ...docList.quote].sort((a, b) => b.id - a.id);
  const list = combined.filter(orderMatchesFilters);
  if (!list.length) {
    const msg = combined.length ? 'No orders or quotes match your filters.' : 'No orders or quotes found.';
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${esc(msg)}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map((d) => {
      const type = docTypeInfo(d);
      const canFulfil = d.kind === 'order' && d.status === 'open';
      return `
      <tr>
        <td>#${d.id}</td>
        <td>${d.title ? esc(d.title) : '<span class="muted">—</span>'}</td>
        <td>${esc(fmtDateTime(d.createdAt))}</td>
        <td>${esc(d.customerName || '—')}</td>
        <td class="num">${money(d.total)}</td>
        <td><span class="badge ${type.cls}">${esc(type.label)}</span></td>
        <td>${
          canFulfil
            ? `<button class="icon-btn" data-load="${d.id}">Load into sale</button> <button class="icon-btn" data-open="${d.id}">Details</button>`
            : `<button class="icon-btn" data-open="${d.id}">View</button>`
        }</td>
      </tr>
    `;
    })
    .join('');
  tbody.querySelectorAll('button[data-open]').forEach((b) => {
    b.addEventListener('click', async () => {
      const doc = await api(`/api/sale-documents/${b.dataset.open}`);
      openModal({ type: 'document-view', doc });
    });
  });
  tbody.querySelectorAll('button[data-load]').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        const doc = await api(`/api/sale-documents/${b.dataset.load}`);
        loadOrderIntoCart(doc);
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

function loadOrderIntoCart(doc) {
  cart = doc.items.map((it) => {
    const product = products.find((p) => p.id === it.productId);
    return {
      productId: it.productId,
      name: it.name,
      sku: it.sku,
      price: it.unitPrice,
      originalPrice: product ? product.price : it.unitPrice,
      qty: it.qty,
      stockQty: product ? product.stockQty : it.qty,
      category: product ? product.category : '',
    };
  });
  discount = doc.discount || 0;
  tillCustomerId = doc.customerId || null;
  cashTendered = '';
  cardAmount = '';
  extraTenders = [];
  activeOrderId = doc.id;
  showToast(`Order #${doc.id} loaded — complete the sale to fulfil it`);
  location.hash = 'till';
}

function changeQty(idx, delta) {
  const line = cart[idx];
  if (!line) return;
  const isService = line.category === 'Services';
  const newQty = line.qty + delta;
  if (newQty <= 0) {
    cart.splice(idx, 1);
  } else if (!isService && newQty > line.stockQty) {
    showToast(`Only ${line.stockQty} of "${line.name}" in stock`);
    return;
  } else {
    line.qty = newQty;
  }
  renderCart();
}

function updateTillTextButton() {
  const btn = document.getElementById('till-text-btn');
  if (btn) btn.disabled = !tillCustomerId;
}

function updateTotals() {
  const totalsEl = document.getElementById('cart-totals');
  if (!totalsEl) return;
  const onTenderPage = !!document.getElementById('cash-tendered');
  const subtotal = cartSubtotal();
  const itemDiscount = cartItemDiscountTotal();
  const netSubtotal = subtotal - itemDiscount;
  const groupDiscount = tillCustomerGroupDiscount(netSubtotal);
  const combinedDiscount = itemDiscount + discount + groupDiscount.amount;
  const total = Math.max(0, subtotal - combinedDiscount);
  let rows = onTenderPage
    ? ''
    : `
    <tr><td>Subtotal</td><td>${money(subtotal)}</td></tr>
    <tr><td>Discount${itemDiscount ? ` <span class="muted">(incl. ${money(itemDiscount)} price edits)</span>` : ''}</td><td>−${money(itemDiscount + discount)}</td></tr>
    ${groupDiscount.amount ? `<tr><td>${esc(groupDiscount.name)} discount (${groupDiscount.percent}%)</td><td>−${money(groupDiscount.amount)}</td></tr>` : ''}
  `;
  rows += `
    <tr class="grand"><td>Total</td><td>${money(total)}</td></tr>
    <tr><td>Inc. VAT (20%)</td><td>${money(vatFromInclusive(total))}</td></tr>
  `;
  const completeBtn = document.getElementById('complete-sale-btn');
  if (onTenderPage) {
    const cashBox = Math.max(0, parseFloat(cashTendered) || 0);
    const { cashAmount, cardAmount: cardApplied } = resolvePaymentAmounts(total);
    const extraTotal = extraTendersTotal();
    const remaining = total - cashAmount - cardApplied - extraTotal;
    rows += `<tr><td>Cash</td><td>${money(cashAmount)}</td></tr>`;
    rows += `<tr><td>Card</td><td>${money(cardApplied)}</td></tr>`;
    for (const t of extraTenders) {
      rows += `<tr><td>${esc(t.name)}</td><td>${money(Math.max(0, parseFloat(t.amount) || 0))}</td></tr>`;
    }
    if (cashBox > cashAmount) {
      rows += `<tr><td>Change due</td><td>${money(cashBox - cashAmount)}</td></tr>`;
    }
    if (Math.abs(remaining) > 0.01) {
      rows += `<tr><td colspan="2" style="color:var(--danger); font-weight:600;">${remaining > 0 ? `${money(remaining)} still to pay` : `${money(Math.abs(remaining))} over the total`}</td></tr>`;
    }
    if (completeBtn) completeBtn.disabled = !activeCashierId || Math.abs(remaining) > 0.01;
  }
  totalsEl.innerHTML = rows;
}

async function completeSale() {
  if (!cart.length) return;
  if (!activeCashierId) {
    showToast('Select a cashier before completing the sale');
    return;
  }
  const { cashAmount: cashApplied, cardAmount: cardApplied } = resolvePaymentAmounts(cartTotal());
  const payload = {
    items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.price })),
    discount,
    cashAmount: cashApplied,
    cardAmount: cardApplied,
    payments: extraTenders.map((t) => ({ tenderType: t.name, amount: parseFloat(t.amount) || 0 })),
    cashTendered: cashApplied > 0 ? (parseFloat(cashTendered) || 0) : null,
    customerId: tillCustomerId,
    cashierId: activeCashierId,
  };
  const btn = document.getElementById('complete-sale-btn');
  btn.disabled = true;
  btn.textContent = 'Processing…';
  try {
    const sale = await api('/api/sales', { method: 'POST', body: payload });
    receiptSale = sale;
    cart = [];
    discount = 0;
    cashTendered = '';
    cardAmount = '';
    extraTenders = [];
    tillCustomerId = null;
    showToast('Sale completed');
    location.hash = 'till';
    openModal({ type: 'receipt', sale });
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
    btn.textContent = 'Complete sale';
  }
}

async function completeOrderFulfillment() {
  if (!cart.length || !activeOrderId) return;
  if (!activeCashierId) {
    showToast('Select a cashier before completing the sale');
    return;
  }
  const { cashAmount: cashApplied, cardAmount: cardApplied } = resolvePaymentAmounts(cartTotal());
  const payload = {
    cashAmount: cashApplied,
    cardAmount: cardApplied,
    payments: extraTenders.map((t) => ({ tenderType: t.name, amount: parseFloat(t.amount) || 0 })),
    cashTendered: cashApplied > 0 ? (parseFloat(cashTendered) || 0) : null,
    cashierId: activeCashierId,
  };
  const btn = document.getElementById('complete-sale-btn');
  btn.disabled = true;
  btn.textContent = 'Processing…';
  try {
    // Items/discount/customer are editable once an order is loaded into the
    // cart, but /convert charges whatever the order itself has saved - push
    // the cart's current state there first so it reflects any edits.
    await api(`/api/sale-documents/${activeOrderId}/items`, {
      method: 'PUT',
      body: {
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.price })),
        discount,
      },
    });
    await api(`/api/sale-documents/${activeOrderId}`, { method: 'PUT', body: { customerId: tillCustomerId } });
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
    btn.textContent = 'Complete sale';
    return;
  }
  try {
    const sale = await api(`/api/sale-documents/${activeOrderId}/convert`, { method: 'POST', body: payload });
    receiptSale = sale;
    cart = [];
    discount = 0;
    cashTendered = '';
    cardAmount = '';
    extraTenders = [];
    tillCustomerId = null;
    activeOrderId = null;
    showToast('Order fulfilled — sale completed');
    location.hash = 'till';
    openModal({ type: 'receipt', sale });
  } catch (err) {
    showToast(err.message);
    btn.disabled = false;
    btn.textContent = 'Complete sale';
  }
}

// ================= OFFICE =================

async function renderOffice() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="subnav" id="office-subnav"></div>
    <div id="office-content"></div>
  `;
  renderOfficeSubnav();
  const parts = route.split('/');
  const sub = parts[1] || 'dashboard';
  const subId = parts[2];
  if (sub === 'inventory' && subId) await renderProductDetail(Number(subId));
  else if (sub === 'inventory') await renderInventory();
  else if (sub === 'suppliers') await renderSuppliers();
  else if (sub === 'purchase-orders' && subId === 'new') await renderPurchaseOrderForm();
  else if (sub === 'purchase-orders' && subId && parts[3] === 'edit') await renderPurchaseOrderForm(Number(subId));
  else if (sub === 'purchase-orders' && subId) await renderPurchaseOrderDetail(Number(subId));
  else if (sub === 'purchase-orders') await renderPurchaseOrders();
  else if (sub === 'sales') await renderSalesHistory();
  else if (sub === 'customers' && subId) await renderCustomerDetail(Number(subId));
  else if (sub === 'customers') await renderCustomers();
  else if (sub === 'edit-shop' && subId === 'front-desk') await renderEditFrontDesk();
  else if (sub === 'edit-shop' && subId === 'logins') await renderEmployeeLogins();
  else if (sub === 'edit-shop' && subId === 'colours') await renderEditColours();
  else if (sub === 'edit-shop') await renderEditWorkshop();
  else await renderDashboard();
}

function renderOfficeSubnav() {
  const wrap = document.getElementById('office-subnav');
  if (!wrap) return;
  const parts = route.split('/');
  const sub = parts[1] || 'dashboard';
  const subId = parts[2];
  wrap.innerHTML = OFFICE_TABS.map((t) => {
    if (!t.children) {
      return `<button data-office-nav="${t.id}" class="pill ${sub === t.id ? 'active' : ''}">${t.label}</button>`;
    }
    return `
      <div class="subnav-dropdown">
        <button data-office-nav="${t.id}" class="pill ${sub === t.id ? 'active' : ''}">${t.label}</button>
        <div class="subnav-dropdown-menu">
          ${t.children()
            .map(
              (c) =>
                `<button data-office-nav="${t.id}" data-office-subnav="${c.id}" class="subnav-dropdown-item ${sub === t.id && (subId || 'workshop') === c.id ? 'active' : ''}">${c.label}</button>`
            )
            .join('')}
        </div>
      </div>
    `;
  }).join('');
  wrap.querySelectorAll('button[data-office-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const childId = btn.dataset.officeSubnav;
      location.hash = childId ? `office/${btn.dataset.officeNav}/${childId}` : `office/${btn.dataset.officeNav}`;
    });
  });
}

// ================= WORKSHOP =================

async function renderWorkshop() {
  workshopPlacing = false;
  await loadWorkshopSettings();
  await loadActiveCustomers();
  await loadMechanics();
  await loadPendingFeed();

  let navHtml;
  let hintText;
  let gridDays;
  let monthDate;

  if (workshopView === 'month') {
    if (!workshopMonthStart) workshopMonthStart = toDateStr(startOfMonth(new Date()));
    monthDate = new Date(workshopMonthStart + 'T00:00:00');
    gridDays = monthGridDays(monthDate);
    await loadWorkshopJobs(toDateStr(gridDays[0]), toDateStr(gridDays[gridDays.length - 1]));
    navHtml = `
      <button class="btn btn-sm" id="month-prev">‹ Prev</button>
      <button class="btn btn-sm" id="month-today">This month</button>
      <button class="btn btn-sm" id="month-next">Next ›</button>
      <span class="week-label">${esc(fmtMonthLabel(monthDate))}</span>
    `;
    hintText = 'Click a day on the calendar to place the new job — or click "Cancel" to stop.';
  } else {
    if (!workshopWeekStart) workshopWeekStart = toDateStr(startOfWeek(new Date()));
    const weekStart = new Date(workshopWeekStart + 'T00:00:00');
    gridDays = [...Array(7)].map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    await loadWorkshopJobs(toDateStr(weekStart), toDateStr(gridDays[6]));
    navHtml = `
      <button class="btn btn-sm" id="week-prev">‹ Prev</button>
      <button class="btn btn-sm" id="week-today">This week</button>
      <button class="btn btn-sm" id="week-next">Next ›</button>
      <span class="week-label">${esc(fmtWeekRange(weekStart, gridDays[6]))}</span>
    `;
    hintText = 'Click a time on the diary to place the new job — or click "Cancel" to stop.';
  }

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="workshop-layout">
      <aside class="workshop-feed" id="workshop-feed"></aside>
      <div class="workshop-main">
        <div class="workshop-header">
          <h1>Workshop</h1>
          <div class="week-nav">
            <button class="btn btn-sm ${workshopView === 'week' ? 'btn-primary' : ''}" id="view-week-btn">Week</button>
            <button class="btn btn-sm ${workshopView === 'month' ? 'btn-primary' : ''}" id="view-month-btn">Month</button>
            ${navHtml}
            <button class="btn btn-sm btn-primary" id="create-job-btn">+ Create job</button>
          </div>
        </div>
        <div class="category-pills" id="mechanic-pills"></div>
        <div class="wk-placing-hint" id="workshop-hint" style="display:none;">${esc(hintText)}</div>
        <div class="week-diaries" id="week-diaries"></div>
      </div>
    </div>
  `;

  renderPendingFeed();

  document.getElementById('view-week-btn').addEventListener('click', () => {
    if (workshopView === 'week') return;
    workshopView = 'week';
    renderWorkshop();
  });
  document.getElementById('view-month-btn').addEventListener('click', () => {
    if (workshopView === 'month') return;
    workshopView = 'month';
    renderWorkshop();
  });
  document.getElementById('create-job-btn').addEventListener('click', () => setWorkshopPlacing(!workshopPlacing));

  if (workshopView === 'month') {
    document.getElementById('month-prev').addEventListener('click', () => shiftWorkshopMonth(-1));
    document.getElementById('month-today').addEventListener('click', () => {
      workshopMonthStart = toDateStr(startOfMonth(new Date()));
      renderWorkshop();
    });
    document.getElementById('month-next').addEventListener('click', () => shiftWorkshopMonth(1));
    renderMechanicPills();
    renderMonthGrid(gridDays, monthDate);
  } else {
    document.getElementById('week-prev').addEventListener('click', () => shiftWorkshopWeek(-7));
    document.getElementById('week-today').addEventListener('click', () => {
      workshopWeekStart = toDateStr(startOfWeek(new Date()));
      renderWorkshop();
    });
    document.getElementById('week-next').addEventListener('click', () => shiftWorkshopWeek(7));
    renderMechanicPills();
    renderWeekGrid(gridDays);
  }
}

function renderMechanicPills() {
  const wrap = document.getElementById('mechanic-pills');
  if (!wrap) return;
  const selectedIds = Array.isArray(workshopMechanicFilter) ? workshopMechanicFilter : [];
  const tabs = [
    { id: 'all', label: 'All', active: workshopMechanicFilter === 'all' },
    { id: 'unassigned', label: 'Unassigned', active: workshopMechanicFilter === 'unassigned' },
    ...mechanics.map((m) => ({ id: String(m.id), label: m.name, active: selectedIds.includes(m.id) })),
  ];
  wrap.innerHTML = tabs
    .map((t) => `<button class="pill ${t.active ? 'active' : ''}" data-mech="${esc(t.id)}">${esc(t.label)}</button>`)
    .join('');
  wrap.querySelectorAll('button[data-mech]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.mech;
      if (val === 'all' || val === 'unassigned') {
        workshopMechanicFilter = val;
      } else {
        const id = Number(val);
        const current = Array.isArray(workshopMechanicFilter) ? [...workshopMechanicFilter] : [];
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        workshopMechanicFilter = next.length ? next : 'all';
      }
      renderMechanicPills();
      refreshWorkshopGrid();
    });
  });
}

function currentWorkshopDays() {
  const weekStart = new Date(workshopWeekStart + 'T00:00:00');
  return [...Array(7)].map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// Re-renders just the grid area for whichever view is currently active,
// without rebuilding the header/nav or re-fetching jobs from the server.
function refreshWorkshopGrid() {
  if (workshopView === 'month') {
    const monthDate = new Date(workshopMonthStart + 'T00:00:00');
    renderMonthGrid(monthGridDays(monthDate), monthDate);
  } else {
    renderWeekGrid(currentWorkshopDays());
  }
}

function visibleWorkshopJobs() {
  const base = workshopJobs;
  if (workshopMechanicFilter === 'all') return base;
  if (workshopMechanicFilter === 'unassigned') return base.filter((j) => !j.mechanicId);
  if (Array.isArray(workshopMechanicFilter)) return base.filter((j) => workshopMechanicFilter.includes(j.mechanicId));
  return base.filter((j) => j.mechanicId === workshopMechanicFilter);
}

// Sidebar list of every pending (customer-submitted, unapproved) job,
// newest request first - lets staff spot a new booking without having to
// notice a purple block somewhere in the grid.
function renderPendingFeed() {
  const wrap = document.getElementById('workshop-feed');
  if (!wrap) return;
  const jobs = [...pendingFeedJobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  wrap.innerHTML = `
    <h2 class="workshop-feed-title">Pending requests${jobs.length ? ` (${jobs.length})` : ''}</h2>
    ${
      jobs.length
        ? jobs
            .map(
              (j) => `
      <button class="pending-feed-item" data-job="${j.id}">
        <span class="pfi-main">${esc(j.bikeLabel || j.title)}</span>
        <span class="pfi-detail">${esc(fmtDayShort(j.jobDate))} ${esc(j.startTime || '')}${j.mechanicName ? ` · ${esc(j.mechanicName)}` : ''}</span>
        ${j.customerName ? `<span class="pfi-detail">${esc(j.customerName)}</span>` : ''}
      </button>
    `
            )
            .join('')
        : `<div class="empty-state">No pending requests.</div>`
    }
  `;
  wrap.querySelectorAll('.pending-feed-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const job = pendingFeedJobs.find((x) => x.id === Number(btn.dataset.job));
      if (job) jumpToPendingJob(job);
    });
  });
}

// Navigates the diary to wherever a pending job lives - switches to week
// view, jumps to its week, and makes sure every mechanic is visible (in
// case the current filter would otherwise hide it) - then scrolls to and
// briefly highlights the actual block so it's obvious which one it is.
async function jumpToPendingJob(job) {
  workshopView = 'week';
  workshopWeekStart = toDateStr(startOfWeek(new Date(job.jobDate + 'T00:00:00')));
  workshopMechanicFilter = mechanics.map((m) => m.id);
  await renderWorkshop();
  const target = document.querySelector(`.wk-job-block[data-job="${job.id}"]`);
  if (!target) return;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('flash-highlight');
  setTimeout(() => target.classList.remove('flash-highlight'), 2000);
}

// When 2+ mechanics are selected at once, the diary splits each day into a
// sub-column per mechanic so their schedules show side by side. A single
// selected mechanic (or 'all'/'unassigned') keeps the normal one-column-per-day view.
function activeMechanicList() {
  if (!Array.isArray(workshopMechanicFilter) || workshopMechanicFilter.length < 2) return null;
  const list = mechanics.filter((m) => workshopMechanicFilter.includes(m.id));
  // If selected mechanics were since removed, fall back to the normal single
  // diary rather than rendering zero of them.
  return list.length >= 2 ? list : null;
}

function setWorkshopPlacing(on) {
  workshopPlacing = on;
  const wrap = document.getElementById('week-diaries');
  const btn = document.getElementById('create-job-btn');
  const hint = document.getElementById('workshop-hint');
  if (wrap) wrap.classList.toggle('placing', on);
  if (btn) btn.textContent = on ? 'Cancel' : '+ Create job';
  if (hint) hint.style.display = on ? '' : 'none';
}

function shiftWorkshopWeek(deltaDays) {
  const d = new Date(workshopWeekStart + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  workshopWeekStart = toDateStr(d);
  renderWorkshop();
}

function fmtWeekRange(start, end) {
  const opts = { day: '2-digit', month: 'short' };
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}${sameYear ? ', ' + end.getFullYear() : ''}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Always 6 full weeks (42 days) so the grid's shape never jumps around when
// navigating between months with different lengths/starting weekdays.
function monthGridDays(monthDate) {
  const gridStart = startOfWeek(startOfMonth(monthDate));
  return [...Array(42)].map((_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function fmtMonthLabel(monthDate) {
  return monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function shiftWorkshopMonth(deltaMonths) {
  const d = new Date(workshopMonthStart + 'T00:00:00');
  d.setMonth(d.getMonth() + deltaMonths);
  workshopMonthStart = toDateStr(startOfMonth(d));
  renderWorkshop();
}

// Workshop diary shows the shop's working hours as a continuous, pixel-positioned
// grid so timed jobs render as draggable/resizable blocks; jobs without a start
// time go in a separate "Unscheduled" row above it. The hour range is driven by
// the workshop's opening/closing time (Office > Edit Workshop), defaulting to
// 09:00-18:00 until that's loaded.
let WORKSHOP_HOUR_START = 9;
let WORKSHOP_HOUR_END = 18;
const WORKSHOP_ROW_PX = 48;
const WORKSHOP_SNAP_MIN = 15;
let WORKSHOP_GRID_HEIGHT = (WORKSHOP_HOUR_END - WORKSHOP_HOUR_START) * WORKSHOP_ROW_PX;
let WORKSHOP_GRID_MIN = WORKSHOP_HOUR_START * 60;
let WORKSHOP_GRID_MAX = WORKSHOP_HOUR_END * 60;

function applyWorkshopHours(openingTime, closingTime) {
  WORKSHOP_HOUR_START = parseInt((openingTime || '09:00').split(':')[0], 10);
  WORKSHOP_HOUR_END = parseInt((closingTime || '18:00').split(':')[0], 10);
  WORKSHOP_GRID_HEIGHT = (WORKSHOP_HOUR_END - WORKSHOP_HOUR_START) * WORKSHOP_ROW_PX;
  WORKSHOP_GRID_MIN = WORKSHOP_HOUR_START * 60;
  WORKSHOP_GRID_MAX = WORKSHOP_HOUR_END * 60;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}
function minutesToGridPx(mins) {
  return ((mins - WORKSHOP_GRID_MIN) / 60) * WORKSHOP_ROW_PX;
}
function timeFromGridY(y) {
  const rawMinutes = WORKSHOP_GRID_MIN + (y / WORKSHOP_ROW_PX) * 60;
  const snapped = Math.round(rawMinutes / 30) * 30;
  return minutesToTime(Math.max(WORKSHOP_GRID_MIN, Math.min(WORKSHOP_GRID_MAX, snapped)));
}

function unscheduledJobsFor(dateStr, mechanicId) {
  let jobs = visibleWorkshopJobs().filter((j) => j.jobDate === dateStr && !j.startTime);
  if (mechanicId !== undefined) jobs = jobs.filter((j) => j.mechanicId === mechanicId);
  return jobs;
}

// The bike (if the job is linked to one) is the bold headline, with the job
// title shown beside it as a secondary label; jobs without a bike just show
// the job title as the headline on its own.
function jobTitleLineHtml(j) {
  if (j.bikeLabel) {
    return `<span class="job-title-line"><span class="job-title">${esc(j.bikeLabel)}</span><span class="job-subtitle">${esc(j.title)}</span></span>`;
  }
  return `<span class="job-title-line"><span class="job-title">${esc(j.title)}</span></span>`;
}

// A job can be 'complete' well before it's actually paid for and picked up
// (the mechanic finishing the work vs. the customer collecting/paying are
// separate events) - this extra modifier class lightens complete+paid jobs
// so a glance at the diary shows "done, still owed" vs. "done and gone".
// j.orderStatus is the linked order's own status ('open'/'converted'/...),
// already joined onto the job by the server - 'converted' means it was
// actually tendered off at the till, not just marked complete.
function jobPaidClass(j) {
  return j.status === 'complete' && j.orderStatus === 'converted' ? ' paid' : '';
}

function renderJobCard(j) {
  return `
    <button class="job-card status-${j.status || 'scheduled'}${jobPaidClass(j)}" data-job="${j.id}">
      ${j.startTime ? `<span class="job-time">${esc(j.startTime)}</span>` : ''}
      ${jobTitleLineHtml(j)}
      ${j.customerName ? `<span class="job-customer">${esc(j.customerName)}</span>` : ''}
      ${j.mechanicName ? `<span class="job-mechanic">${esc(j.mechanicName)}</span>` : ''}
      <span class="job-status-badge">${esc(JOB_STATUS_LABELS[j.status] || JOB_STATUS_LABELS.scheduled)}</span>
    </button>
  `;
}

function renderUnscheduledCell(dateStr, isToday, mechanicId, dayOff) {
  const jobs = unscheduledJobsFor(dateStr, mechanicId);
  const mechAttr = mechanicId !== undefined ? ` data-mechanic="${mechanicId}"` : '';
  return `
    <div class="wk-cell ${isToday ? 'today' : ''} ${dayOff ? 'day-off' : ''}" data-date="${dateStr}"${mechAttr}>
      ${jobs.map(renderJobCard).join('')}
    </div>
  `;
}

function renderHourLabelsColumn() {
  let labels = '';
  for (let h = WORKSHOP_HOUR_START; h < WORKSHOP_HOUR_END; h++) {
    const top = (h - WORKSHOP_HOUR_START) * WORKSHOP_ROW_PX;
    labels += `<div class="wk-hour-label" style="top:${top}px;">${String(h).padStart(2, '0')}:00</div>`;
  }
  return `<div class="wk-hour-labels" style="height:${WORKSHOP_GRID_HEIGHT}px;">${labels}</div>`;
}

function renderTimedDayColumn(dateStr, isToday, mechanicId, dayOff) {
  let jobs = visibleWorkshopJobs().filter((j) => j.jobDate === dateStr && j.startTime);
  if (mechanicId !== undefined) jobs = jobs.filter((j) => j.mechanicId === mechanicId);
  const blocksHtml = jobs
    .map((j) => {
      const startMin = timeToMinutes(j.startTime);
      const endMin = timeToMinutes(j.endTime || minutesToTime(startMin + 60));
      const top = minutesToGridPx(Math.max(startMin, WORKSHOP_GRID_MIN));
      const bottom = minutesToGridPx(Math.min(endMin, WORKSHOP_GRID_MAX));
      // Floor raised to guarantee the bike name (the first line in the body,
      // see below) always has room to render, even for a very short job -
      // at the old 18px floor it was reliably clipped by the body's own
      // overflow:hidden before a single line could fit alongside the two
      // 6px resize handles + body padding.
      const height = Math.max(34, bottom - top);
      return `
        <div class="wk-job-block status-${j.status || 'scheduled'}${jobPaidClass(j)}" data-job="${j.id}" style="top:${top}px; height:${height}px;">
          <div class="wk-resize-handle" data-edge="top"></div>
          <div class="wk-job-block-body">
            ${jobTitleLineHtml(j)}
            <span class="job-time">${esc(j.startTime)}–${esc(j.endTime || minutesToTime(startMin + 60))}</span>
            ${j.customerName ? `<span class="job-customer">${esc(j.customerName)}</span>` : ''}
            ${j.mechanicName ? `<span class="job-mechanic">${esc(j.mechanicName)}</span>` : ''}
            <span class="job-status-badge">${esc(JOB_STATUS_LABELS[j.status] || JOB_STATUS_LABELS.scheduled)}</span>
          </div>
          <div class="wk-resize-handle" data-edge="bottom"></div>
        </div>
      `;
    })
    .join('');
  return `
    <div class="wk-day-col ${isToday ? 'today' : ''} ${dayOff ? 'day-off' : ''}" data-date="${dateStr}"${mechanicId !== undefined ? ` data-mechanic="${mechanicId}"` : ''} style="height:${WORKSHOP_GRID_HEIGHT}px;">
      ${blocksHtml}
    </div>
  `;
}

const WORKSHOP_DRAG_THRESHOLD_PX = 4;

// Dragging the block body (as opposed to the resize handles) moves the job to
// a different time and/or day, preserving its duration. A plain click (no
// movement past the threshold) still opens the edit modal. Click-vs-drag is
// decided entirely from the mousedown/mouseup pair below, not from the
// browser's own synthetic "click" event - that event's target can end up
// resolving to whatever's underneath once the block gets pointer-events:none
// mid-drag, which was intermittently reopening the edit modal after a drag.
function wireJobBlockMove(blockEl, job) {
  const body = blockEl.querySelector('.wk-job-block-body');

  body.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origRect = blockEl.getBoundingClientRect();
    const offsetX = startX - origRect.left;
    const offsetY = startY - origRect.top;
    const origStartMin = timeToMinutes(job.startTime);
    const origEndMin = timeToMinutes(job.endTime || minutesToTime(origStartMin + 60));
    const durationMin = origEndMin - origStartMin;
    const origDate = job.jobDate;
    const origMechanicId = job.mechanicId ?? null;

    let dragging = false;
    let pendingDate = origDate;
    let pendingStartMin = origStartMin;
    let pendingMechanicId = origMechanicId;
    let targetCol = null;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < WORKSHOP_DRAG_THRESHOLD_PX && Math.abs(dy) < WORKSHOP_DRAG_THRESHOLD_PX) return;
        dragging = true;
        blockEl.classList.add('dragging');
        blockEl.style.position = 'fixed';
        blockEl.style.width = `${origRect.width}px`;
        blockEl.style.zIndex = '50';
        blockEl.style.pointerEvents = 'none';
      }
      blockEl.style.left = `${ev.clientX - offsetX}px`;
      blockEl.style.top = `${ev.clientY - offsetY}px`;

      const underEl = document.elementFromPoint(ev.clientX, ev.clientY);
      let hoveredCol = underEl ? underEl.closest('.wk-day-col') : null;
      if (hoveredCol && hoveredCol.classList.contains('day-off')) hoveredCol = null;
      if (targetCol && targetCol !== hoveredCol) targetCol.classList.remove('drop-target');
      if (hoveredCol) {
        hoveredCol.classList.add('drop-target');
        const rect = hoveredCol.getBoundingClientRect();
        const cardTop = ev.clientY - offsetY;
        const rawMinutes = WORKSHOP_GRID_MIN + ((cardTop - rect.top) / WORKSHOP_ROW_PX) * 60;
        const snapped = Math.round(rawMinutes / WORKSHOP_SNAP_MIN) * WORKSHOP_SNAP_MIN;
        pendingStartMin = Math.max(WORKSHOP_GRID_MIN, Math.min(WORKSHOP_GRID_MAX - durationMin, snapped));
        pendingDate = hoveredCol.dataset.date;
        pendingMechanicId = hoveredCol.dataset.mechanic !== undefined ? Number(hoveredCol.dataset.mechanic) : origMechanicId;

        const timeLabel = blockEl.querySelector('.job-time');
        if (timeLabel) {
          const newStart = minutesToTime(pendingStartMin);
          const newEnd = minutesToTime(pendingStartMin + durationMin);
          const dateChanged = pendingDate !== origDate;
          timeLabel.textContent = dateChanged
            ? `${fmtDayShort(pendingDate)} ${newStart}–${newEnd}`
            : `${newStart}–${newEnd}`;
        }
      }
      targetCol = hoveredCol;
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (targetCol) targetCol.classList.remove('drop-target');

      if (!dragging) {
        openModal({ type: 'workshop-job-form', job });
        return;
      }

      const changed =
        targetCol && (pendingDate !== origDate || pendingStartMin !== origStartMin || pendingMechanicId !== origMechanicId);
      if (changed) {
        const newStart = minutesToTime(pendingStartMin);
        const newEnd = minutesToTime(pendingStartMin + durationMin);
        const body = { jobDate: pendingDate, startTime: newStart, endTime: newEnd };
        if (pendingMechanicId !== origMechanicId) body.mechanicId = pendingMechanicId;
        try {
          await api(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body });
        } catch (err) {
          showToast(err.message);
        }
      }
      await renderWorkshop();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // The browser still fires its own "click" after mouseup regardless of what
  // happened above - swallow it so it never bubbles to the day-column's
  // "add job" handler. Opening the edit modal is handled entirely in onUp.
  body.addEventListener('click', (e) => e.stopPropagation());
}

function wireJobBlockResize(blockEl, job) {
  blockEl.querySelectorAll('.wk-resize-handle').forEach((handle) => {
    handle.addEventListener('click', (e) => e.stopPropagation());
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const edge = handle.dataset.edge;
      const startY = e.clientY;
      const origStartMin = timeToMinutes(job.startTime);
      const origEndMin = timeToMinutes(job.endTime || minutesToTime(origStartMin + 60));
      let pendingStart = job.startTime;
      let pendingEnd = job.endTime || minutesToTime(origStartMin + 60);
      blockEl.classList.add('dragging');

      function onMove(ev) {
        const deltaPx = ev.clientY - startY;
        const deltaMin = Math.round(((deltaPx / WORKSHOP_ROW_PX) * 60) / WORKSHOP_SNAP_MIN) * WORKSHOP_SNAP_MIN;
        let newStartMin = origStartMin;
        let newEndMin = origEndMin;
        if (edge === 'top') {
          newStartMin = Math.max(WORKSHOP_GRID_MIN, Math.min(origEndMin - WORKSHOP_SNAP_MIN, origStartMin + deltaMin));
        } else {
          newEndMin = Math.min(WORKSHOP_GRID_MAX, Math.max(origStartMin + WORKSHOP_SNAP_MIN, origEndMin + deltaMin));
        }
        pendingStart = minutesToTime(newStartMin);
        pendingEnd = minutesToTime(newEndMin);
        const top = minutesToGridPx(newStartMin);
        const height = Math.max(18, minutesToGridPx(newEndMin) - top);
        blockEl.style.top = `${top}px`;
        blockEl.style.height = `${height}px`;
        const timeLabel = blockEl.querySelector('.job-time');
        if (timeLabel) timeLabel.textContent = `${pendingStart}–${pendingEnd}`;
      }

      async function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        blockEl.classList.remove('dragging');
        if (pendingStart === job.startTime && pendingEnd === job.endTime) return;
        try {
          await api(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { startTime: pendingStart, endTime: pendingEnd } });
        } catch (err) {
          showToast(err.message);
        }
        await renderWorkshop();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// Builds the inner HTML for one complete week grid (day headers, Unscheduled
// row, hour-labelled timed grid). mechanicId undefined means "whatever the
// pill filter currently resolves to" (via visibleWorkshopJobs); a specific
// id isolates that one mechanic's jobs regardless of the pill state, used
// when rendering a separate diary per selected mechanic.
function buildWeekGridHtml(days, mechanicId) {
  const todayStr = toDateStr(new Date());
  // A diary scoped to one specific mechanic also greys out their own days
  // off; the combined All/Unassigned view isn't tied to one schedule, but
  // shop-closed days grey out everywhere regardless of mechanic.
  const mechanic = mechanicId !== undefined ? mechanics.find((m) => m.id === mechanicId) : null;
  const isDayOff = (d) => {
    const dow = d.getDay();
    if (!workshopSettings.openingDays.includes(dow)) return true;
    return !!mechanic && !mechanic.workingDays.includes(dow);
  };

  let html = '<div class="wk-corner"></div>';
  html += days
    .map((d) => {
      const dateStr = toDateStr(d);
      return `
      <div class="wk-day-header ${dateStr === todayStr ? 'today' : ''} ${isDayOff(d) ? 'day-off' : ''}">
        <span class="wd-name">${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))}</span>
        <span class="wd-date">${esc(d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }))}</span>
      </div>
    `;
    })
    .join('');

  html += `<div class="wk-time-label">Unscheduled</div>`;
  html += days.map((d) => renderUnscheduledCell(toDateStr(d), toDateStr(d) === todayStr, mechanicId, isDayOff(d))).join('');

  html += renderHourLabelsColumn();
  html += days.map((d) => renderTimedDayColumn(toDateStr(d), toDateStr(d) === todayStr, mechanicId, isDayOff(d))).join('');

  return html;
}

function renderWeekGrid(days) {
  const wrap = document.getElementById('week-diaries');
  if (!wrap) return;
  const activeMechs = activeMechanicList();

  if (!activeMechs) {
    wrap.classList.remove('split');
    const soloMechanicId =
      Array.isArray(workshopMechanicFilter) && workshopMechanicFilter.length === 1 ? workshopMechanicFilter[0] : undefined;
    wrap.innerHTML = `
      <div class="week-diary">
        <div class="week-grid-scroll"><div class="week-grid">${buildWeekGridHtml(days, soloMechanicId)}</div></div>
      </div>
    `;
  } else {
    wrap.classList.add('split');
    wrap.innerHTML = activeMechs
      .map(
        (m) => `
      <div class="week-diary">
        <div class="week-diary-title">${esc(m.name)}</div>
        <div class="week-grid-scroll"><div class="week-grid">${buildWeekGridHtml(days, m.id)}</div></div>
      </div>
    `
      )
      .join('');
  }

  wireGridInteractions();
}

// Hover summary - a short delay avoids flashing a tooltip on every card the
// mouse merely passes over while scanning the diary.
const JOB_TOOLTIP_DELAY_MS = 200;
let jobTooltipTimer = null;

const JOB_TOOLTIP_CURSOR_GAP = 14;

// Tracked continuously (not just captured at mouseenter) so the tooltip
// appears wherever the cursor actually is once the delay elapses, not where
// it happened to be when the hover started.
let lastMouseX = 0;
let lastMouseY = 0;
document.addEventListener('mousemove', (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

function wireJobTooltipOn(container, selector) {
  container.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('mouseenter', () => {
      clearTimeout(jobTooltipTimer);
      const job = workshopJobs.find((x) => x.id === Number(el.dataset.job));
      if (!job) return;
      jobTooltipTimer = setTimeout(() => showJobTooltip(el, job), JOB_TOOLTIP_DELAY_MS);
    });
    el.addEventListener('mouseleave', () => {
      clearTimeout(jobTooltipTimer);
      hideJobTooltip();
    });
  });
}

function hideJobTooltip() {
  const el = document.getElementById('job-tooltip');
  if (el) el.remove();
}

function showJobTooltip(anchorEl, job) {
  // A drag can start during the delay window - don't pop a tooltip over a
  // block the user is actively moving.
  if (anchorEl.classList.contains('dragging')) return;
  hideJobTooltip();
  const statusLabel = esc(JOB_STATUS_LABELS[job.status] || JOB_STATUS_LABELS.scheduled);
  const statusColor = `var(--status-${job.status || 'scheduled'}-border)`;
  const tip = document.createElement('div');
  tip.id = 'job-tooltip';
  tip.className = 'job-tooltip';
  tip.innerHTML = `
    <div class="job-tooltip-bike">${esc(job.bikeLabel || 'No bike on file')}</div>
    <div class="job-tooltip-row">${esc(job.title)}</div>
    <div class="job-tooltip-row">${esc(job.customerName || 'No customer')}</div>
    <div class="job-tooltip-row">Status: <strong style="color:${statusColor};">${statusLabel}</strong></div>
    <div class="job-tooltip-row">${job.orderId ? `Order total: ${money(job.orderTotal)}` : 'No order linked'}</div>
  `;
  document.body.appendChild(tip);

  // Defaults to the cursor's right, flipping to its left only if there's
  // not enough room - not anchored to the card itself, since a right-side
  // placement relative to a wide/short card could still overlap it.
  const tipRect = tip.getBoundingClientRect();
  let x = lastMouseX + JOB_TOOLTIP_CURSOR_GAP;
  if (x + tipRect.width > window.innerWidth - 8) {
    x = lastMouseX - JOB_TOOLTIP_CURSOR_GAP - tipRect.width;
  }
  let y = lastMouseY;
  if (y + tipRect.height > window.innerHeight - 8) y = window.innerHeight - tipRect.height - 8;
  tip.style.left = Math.max(8, x) + 'px';
  tip.style.top = Math.max(8, y) + 'px';
}

// Right-click quick actions on a job card/block/chip/row - wired onto
// whichever of the four job-card DOM shapes (see JOB_CARD_SELECTOR callers
// below) is on screen. Reuses loadOrderIntoCart/the receipt modal rather
// than inventing new job-specific logic, since "the order for this job" is
// just a normal sale_document (see job.orderId, joined server-side).
function wireJobContextMenuOn(container, selector) {
  container.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('contextmenu', (e) => {
      const job = workshopJobs.find((x) => x.id === Number(el.dataset.job));
      if (job) openJobContextMenu(e, job);
    });
  });
}

function closeJobContextMenu() {
  const el = document.getElementById('job-context-menu');
  if (el) el.remove();
  document.removeEventListener('keydown', closeJobContextMenuOnEscape);
}

function closeJobContextMenuOnEscape(e) {
  if (e.key === 'Escape') closeJobContextMenu();
}

function openJobContextMenu(e, job) {
  e.preventDefault();
  e.stopPropagation();
  closeJobContextMenu();
  clearTimeout(jobTooltipTimer);
  hideJobTooltip();

  const hasOrder = !!job.orderId;
  const isPending = job.status === 'pending';
  const menu = document.createElement('div');
  menu.id = 'job-context-menu';
  menu.className = 'context-menu';
  menu.innerHTML = `
    ${isPending ? `<button type="button" class="context-menu-item" data-action="approve">Approve</button>` : ''}
    <button type="button" class="context-menu-item" data-action="receipt" ${hasOrder ? '' : 'disabled title="No order linked to this job"'}>Print receipt for this job</button>
    <button type="button" class="context-menu-item" data-action="frontdesk" ${hasOrder ? '' : 'disabled title="No order linked to this job"'}>Open order in Front Desk</button>
  `;
  document.body.appendChild(menu);

  const menuRect = menu.getBoundingClientRect();
  const x = Math.min(e.clientX, window.innerWidth - menuRect.width - 8);
  const y = Math.min(e.clientY, window.innerHeight - menuRect.height - 8);
  menu.style.left = Math.max(8, x) + 'px';
  menu.style.top = Math.max(8, y) + 'px';

  if (isPending) {
    menu.querySelector('[data-action="approve"]').addEventListener('click', () => {
      closeJobContextMenu();
      approveJob(job);
    });
  }
  if (hasOrder) {
    menu.querySelector('[data-action="receipt"]').addEventListener('click', () => {
      closeJobContextMenu();
      printJobOrderReceipt(job);
    });
    menu.querySelector('[data-action="frontdesk"]').addEventListener('click', () => {
      closeJobContextMenu();
      openJobOrderInFrontDesk(job);
    });
  }

  // Deferred so the contextmenu event that opened this menu doesn't
  // immediately trigger its own outside-click listener.
  setTimeout(() => {
    document.addEventListener('click', closeJobContextMenu, { once: true });
    document.addEventListener('contextmenu', closeJobContextMenu, { once: true });
  }, 0);
  document.addEventListener('keydown', closeJobContextMenuOnEscape);
}

async function approveJob(job) {
  try {
    await api(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { status: 'scheduled' } });
    showToast('Job approved');
    if (document.getElementById('week-diaries')) await renderWorkshop();
  } catch (err) {
    showToast(err.message);
  }
}

async function printJobOrderReceipt(job) {
  try {
    const doc = await api(`/api/sale-documents/${job.orderId}`);
    if (!doc.convertedSaleId) {
      showToast("This order hasn't been checked out yet - nothing to print.");
      return;
    }
    const sale = await api(`/api/sales/${doc.convertedSaleId}`);
    openModal({ type: 'receipt', sale, title: `Sale #${sale.id}` });
  } catch (err) {
    showToast(err.message);
  }
}

async function openJobOrderInFrontDesk(job) {
  try {
    const doc = await api(`/api/sale-documents/${job.orderId}`);
    if (doc.status !== 'open') {
      showToast(`This order is already ${doc.status} - nothing to fulfil.`);
      return;
    }
    loadOrderIntoCart(doc);
  } catch (err) {
    showToast(err.message);
  }
}

function wireGridInteractions() {
  const wrap = document.getElementById('week-diaries');
  if (!wrap) return;

  wrap.querySelectorAll('.wk-cell button[data-job]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const job = workshopJobs.find((x) => x.id === Number(b.dataset.job));
      openModal({ type: 'workshop-job-form', job });
    });
  });
  wrap.querySelectorAll('.wk-cell').forEach((cellEl) => {
    cellEl.addEventListener('click', () => {
      if (!workshopPlacing || cellEl.classList.contains('day-off')) return;
      setWorkshopPlacing(false);
      const mech = cellEl.dataset.mechanic;
      openModal({
        type: 'workshop-job-form',
        job: null,
        defaultDate: cellEl.dataset.date,
        defaultMechanicId: mech !== undefined ? Number(mech) : undefined,
      });
    });
  });

  wrap.querySelectorAll('.wk-job-block').forEach((blockEl) => {
    const job = workshopJobs.find((x) => x.id === Number(blockEl.dataset.job));
    if (!job) return;
    wireJobBlockMove(blockEl, job);
    wireJobBlockResize(blockEl, job);
  });
  wireJobContextMenuOn(wrap, '.job-card, .wk-job-block');
  wireJobTooltipOn(wrap, '.job-card, .wk-job-block');

  wrap.querySelectorAll('.wk-day-col').forEach((colEl) => {
    colEl.addEventListener('click', (e) => {
      if (!workshopPlacing || colEl.classList.contains('day-off')) return;
      const rect = colEl.getBoundingClientRect();
      const time = timeFromGridY(e.clientY - rect.top);
      setWorkshopPlacing(false);
      const mech = colEl.dataset.mechanic;
      openModal({
        type: 'workshop-job-form',
        job: null,
        defaultDate: colEl.dataset.date,
        defaultTime: time,
        defaultMechanicId: mech !== undefined ? Number(mech) : undefined,
      });
    });
  });
}

// ================= WORKSHOP: MONTH VIEW =================

const MONTH_CHIP_LIMIT = 3;

function renderMonthJobChip(j) {
  const mainText = j.bikeLabel || j.title;
  return `
    <button class="month-job-chip status-${j.status || 'scheduled'}${jobPaidClass(j)}" data-job="${j.id}">
      ${j.startTime ? `<span class="mjc-time">${esc(j.startTime)}</span>` : ''}<span class="mjc-title"><span class="mjc-main">${esc(mainText)}</span>${j.bikeLabel ? ` <span class="mjc-sub">${esc(j.title)}</span>` : ''}</span>
    </button>
  `;
}

function buildMonthGridHtml(gridDays, monthDate, mechanicId) {
  const todayStr = toDateStr(new Date());
  const mechanic = mechanicId !== undefined ? mechanics.find((m) => m.id === mechanicId) : null;
  const isDayOff = (d) => {
    const dow = d.getDay();
    if (!workshopSettings.openingDays.includes(dow)) return true;
    return !!mechanic && !mechanic.workingDays.includes(dow);
  };
  const monthIndex = monthDate.getMonth();

  let html = WEEKDAY_ORDER.map((wd) => `<div class="month-dow">${esc(WEEKDAY_LABELS[wd])}</div>`).join('');

  html += gridDays
    .map((d) => {
      const dateStr = toDateStr(d);
      const dayOff = isDayOff(d);
      const otherMonth = d.getMonth() !== monthIndex;
      let jobs = visibleWorkshopJobs().filter((j) => j.jobDate === dateStr);
      if (mechanicId !== undefined) jobs = jobs.filter((j) => j.mechanicId === mechanicId);
      jobs = jobs.slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      const shown = jobs.slice(0, MONTH_CHIP_LIMIT);
      const extra = jobs.length - shown.length;
      const mechAttr = mechanicId !== undefined ? ` data-mechanic="${mechanicId}"` : '';

      return `
      <div class="month-cell ${dateStr === todayStr ? 'today' : ''} ${otherMonth ? 'other-month' : ''} ${dayOff ? 'day-off' : ''}" data-date="${dateStr}"${mechAttr}>
        <div class="month-cell-date">${d.getDate()}</div>
        <div class="month-cell-jobs">
          ${shown.map(renderMonthJobChip).join('')}
          ${extra > 0 ? `<button class="month-more-btn" data-date="${dateStr}"${mechAttr}>+${extra} more</button>` : ''}
        </div>
      </div>
    `;
    })
    .join('');

  return `<div class="month-grid">${html}</div>`;
}

function renderMonthGrid(gridDays, monthDate) {
  const wrap = document.getElementById('week-diaries');
  if (!wrap) return;
  const activeMechs = activeMechanicList();

  if (!activeMechs) {
    wrap.classList.remove('split');
    const soloMechanicId =
      Array.isArray(workshopMechanicFilter) && workshopMechanicFilter.length === 1 ? workshopMechanicFilter[0] : undefined;
    wrap.innerHTML = `<div class="week-diary">${buildMonthGridHtml(gridDays, monthDate, soloMechanicId)}</div>`;
  } else {
    wrap.classList.add('split');
    wrap.innerHTML = activeMechs
      .map(
        (m) => `
      <div class="week-diary">
        <div class="week-diary-title">${esc(m.name)}</div>
        ${buildMonthGridHtml(gridDays, monthDate, m.id)}
      </div>
    `
      )
      .join('');
  }

  wireMonthInteractions();
}

function wireMonthInteractions() {
  const wrap = document.getElementById('week-diaries');
  if (!wrap) return;

  wrap.querySelectorAll('.month-job-chip').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const job = workshopJobs.find((x) => x.id === Number(b.dataset.job));
      openModal({ type: 'workshop-job-form', job });
    });
  });
  wireJobContextMenuOn(wrap, '.month-job-chip');
  wireJobTooltipOn(wrap, '.month-job-chip');

  wrap.querySelectorAll('.month-more-btn').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const dateStr = b.dataset.date;
      const mech = b.dataset.mechanic;
      let jobs = visibleWorkshopJobs().filter((j) => j.jobDate === dateStr);
      if (mech !== undefined) jobs = jobs.filter((j) => j.mechanicId === Number(mech));
      jobs = jobs.slice().sort((a, c) => (a.startTime || '').localeCompare(c.startTime || ''));
      openModal({ type: 'day-jobs', dateStr, jobs });
    });
  });

  wrap.querySelectorAll('.month-cell').forEach((cellEl) => {
    cellEl.addEventListener('click', () => {
      if (!workshopPlacing || cellEl.classList.contains('day-off')) return;
      setWorkshopPlacing(false);
      const mech = cellEl.dataset.mechanic;
      openModal({
        type: 'workshop-job-form',
        job: null,
        defaultDate: cellEl.dataset.date,
        defaultMechanicId: mech !== undefined ? Number(mech) : undefined,
      });
    });
  });
}

// ================= BARCODE (Code128, subset B) =================
// Used only by the sticker-printing feature below. Subset B covers every
// printable ASCII character (32-126), so the same encoder handles both a
// shop-assigned SKU and a real supplier-provided barcode without needing
// two encoders or validating digit counts/checksums the way EAN-13 would.
// Standard 107-row Code128 width table - each row is the module widths of
// six alternating bar/space runs (always starting on a bar), row 106
// (STOP) has a seventh trailing width. No prior barcode code exists in
// this codebase to reuse.

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const CODE128_START_B = 104;
const CODE128_STOP = 106;

// Returns the module-width sequence (numbers, alternating bar/space
// starting with a bar) Code128 uses to encode `text`, or null if it
// contains a character outside subset B's range (32-126) - callers fall
// back to showing the text without a barcode graphic in that case.
function code128Bars(text) {
  const symbols = [CODE128_START_B];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) return null;
    symbols.push(code - 32);
  }
  let checksum = symbols[0];
  for (let i = 1; i < symbols.length; i++) checksum += symbols[i] * i;
  symbols.push(checksum % 103);
  symbols.push(CODE128_STOP);

  const widths = [];
  symbols.forEach((s) => {
    for (const ch of CODE128_PATTERNS[s]) widths.push(Number(ch));
  });
  return widths;
}

// Converts a Code128 module-width sequence into plain mm bar rectangles
// ({xMm, wMm}, all at y=0 with height=heightMm) - the module width is
// derived from the total module count so any label size just works without
// per-size tuning. Shared by barcodeSvg (on-screen/browser-print) and
// buildStickerPrintJob (print-agent draw primitives) so the bar-position
// math exists in exactly one place. Returns null if `text` can't be
// encoded (see code128Bars).
function code128Rects(text, widthMm, heightMm) {
  const widths = code128Bars(text);
  if (!widths) return null;
  const totalModules = widths.reduce((a, b) => a + b, 0);
  const moduleWidth = widthMm / totalModules;
  let x = 0;
  const rects = [];
  widths.forEach((w, i) => {
    const barWidth = w * moduleWidth;
    // Even index = a bar (the sequence always starts on a bar and alternates).
    if (i % 2 === 0) rects.push({ xMm: x, wMm: barWidth });
    x += barWidth;
  });
  return rects;
}

// Renders a Code128 barcode as inline SVG sized to fill `widthMm`. Returns
// null if `text` can't be encoded (see code128Bars).
function barcodeSvg(text, widthMm, heightMm) {
  const rects = code128Rects(text, widthMm, heightMm);
  if (!rects) return null;
  const bars = rects
    .map((r) => `<rect x="${r.xMm.toFixed(3)}" y="0" width="${r.wMm.toFixed(3)}" height="${heightMm}" fill="#000" />`)
    .join('');
  return `<svg viewBox="0 0 ${widthMm} ${heightMm}" width="${widthMm}mm" height="${heightMm}mm" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

// Picks what to encode (a real supplier barcode wins over an internal SKU,
// matching how till search already matches either) and renders it -
// `svg: null` means either nothing to encode or a character Code128 can't
// represent, in which case callers show `note` instead of a blank barcode.
function stickerBarcode(product, widthMm, heightMm) {
  const code = (product.barcode || product.sku || '').trim();
  if (!code) return { code: '', svg: null, note: 'No barcode set' };
  const svg = barcodeSvg(code, widthMm, heightMm);
  if (!svg) return { code, svg: null, note: "Can't be printed as a barcode" };
  return { code, svg, note: '' };
}

// Shared between the on-screen/print-preview layout (buildStickerPageHtml's
// CSS flex) and the print agent's absolute-position draw primitives
// (buildStickerPrintJob) - just the numbers that need to match between the
// two, so the barcode's share of the label doesn't drift out of sync if
// this ratio ever changes.
function stickerBarcodeAreaMm(widthMm, heightMm) {
  return { widthMm: Math.max(5, widthMm - 4), heightMm: Math.max(4, heightMm * 0.4) };
}

// ================= INVENTORY =================

async function renderInventory() {
  await loadProductsAll();
  if (!labelSettingsLoaded) await loadLabelSettings();
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Stockroom</h2>
        <button class="btn btn-primary" id="add-product-btn">+ Add product</button>
      </div>
      <div class="panel-body">
        <div class="table-toolbar">
          <input type="text" id="inv-search" class="search-input" placeholder="Search name, SKU or barcode…" value="${esc(inventorySearch)}" />
          <select id="inv-category">
            <option value="">All categories</option>
            ${categories.map((c) => `<option value="${esc(c)}" ${inventoryCategory === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:13.5px;">
            <input type="checkbox" id="inv-show-inactive" ${inventoryShowInactive ? 'checked' : ''} /> Show deactivated
          </label>
          <button class="btn btn-sm" id="inv-print-stickers-btn" style="display:none;"></button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" id="inv-select-all" /></th>
                <th>SKU</th><th>Barcode</th><th>Name</th><th>Category</th>
                <th class="num">Price (inc. VAT)</th><th class="num">Cost</th><th class="num">VAT (20%)</th><th class="num">Margin</th><th class="num">Stock</th>
                <th>Supplier</th><th></th>
              </tr>
            </thead>
            <tbody id="inv-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-product-btn').addEventListener('click', () => openModal({ type: 'product-form', product: null }));
  document.getElementById('inv-search').addEventListener('input', (e) => {
    inventorySearch = e.target.value;
    renderInventoryTable();
  });
  document.getElementById('inv-category').addEventListener('change', (e) => {
    inventoryCategory = e.target.value;
    renderInventoryTable();
  });
  document.getElementById('inv-show-inactive').addEventListener('change', async (e) => {
    inventoryShowInactive = e.target.checked;
    await loadProductsAll();
    renderInventoryTable();
  });
  document.getElementById('inv-print-stickers-btn').addEventListener('click', () => {
    const selected = products.filter((p) => inventorySelectedIds.has(p.id));
    openModal({ type: 'sticker-print', products: selected });
  });

  renderInventoryTable();
}

// Shows/hides and labels the bulk "Print stickers" toolbar button - called
// after any selection change and at the end of every renderInventoryTable()
// re-render, since a filter/search change can hide selected rows without
// clearing the selection itself.
function updateStickerToolbarButton() {
  const btn = document.getElementById('inv-print-stickers-btn');
  if (!btn) return;
  const n = inventorySelectedIds.size;
  btn.style.display = n ? '' : 'none';
  btn.textContent = `Print stickers (${n})`;
}

function renderInventoryTable() {
  const tbody = document.getElementById('inv-table-body');
  if (!tbody) return;
  const term = inventorySearch.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (inventoryCategory && p.category !== inventoryCategory) return false;
    if (
      term &&
      !(
        p.name.toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term)
      )
    )
      return false;
    return true;
  });
  // Selection survives a search/filter change (so picking items across
  // several searches works) - only drop an id once the product itself is
  // actually gone (deactivated out of the loaded set, or deleted), so the
  // toolbar button's count never silently includes an id nothing points at.
  for (const id of inventorySelectedIds) {
    if (!products.some((p) => p.id === id)) inventorySelectedIds.delete(id);
  }
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="12"><div class="empty-state">No products found.</div></td></tr>`;
    updateStickerToolbarButton();
    return;
  }
  tbody.innerHTML = filtered
    .map((p) => {
      const low = p.category !== 'Services' && p.stockQty <= p.lowStockThreshold;
      const inactiveTag = !p.active ? ' <span class="badge low">Inactive</span>' : '';
      // UK-style VAT-inclusive pricing: p.price already contains 20% VAT,
      // so the VAT portion and margin are both derived from the net (ex-VAT) price.
      const netPrice = p.price / 1.2;
      const vat = p.price - netPrice;
      const margin = netPrice > 0 ? ((netPrice - p.cost) / netPrice) * 100 : null;
      const marginLow = margin === null || margin < 20;
      return `
      <tr>
        <td><input type="checkbox" data-select="${p.id}" ${inventorySelectedIds.has(p.id) ? 'checked' : ''} /></td>
        <td>${esc(p.sku || '—')}</td>
        <td>${esc(p.barcode || '—')}</td>
        <td><button class="link-btn" data-view="${p.id}">${esc(p.name)}</button>${inactiveTag}</td>
        <td>${esc(p.category)}</td>
        <td class="num">${money(p.price)}</td>
        <td class="num">${money(p.cost)}</td>
        <td class="num">${money(vat)}</td>
        <td class="num">${margin === null ? '—' : `<span class="badge ${marginLow ? 'low' : 'ok'}">${margin.toFixed(1)}%</span>`}</td>
        <td class="num">${p.category === 'Services' ? '—' : `<span class="badge ${low ? 'low' : 'ok'}">${p.stockQty}</span>`}</td>
        <td>${esc(p.supplier || '—')}</td>
        <td>
          <button class="icon-btn" data-sticker="${p.id}">Sticker</button>
          <button class="icon-btn" data-edit="${p.id}">Edit</button>
          ${p.category !== 'Services' ? `<button class="icon-btn" data-stock="${p.id}">Stock</button>` : ''}
          ${p.active ? `<button class="icon-btn" data-deactivate="${p.id}">Deactivate</button>` : `<button class="icon-btn" data-activate="${p.id}">Activate</button>`}
        </td>
      </tr>
    `;
    })
    .join('');

  const selectAllCb = document.getElementById('inv-select-all');
  if (selectAllCb) {
    selectAllCb.checked = filtered.length > 0 && filtered.every((p) => inventorySelectedIds.has(p.id));
    selectAllCb.addEventListener('change', () => {
      if (selectAllCb.checked) filtered.forEach((p) => inventorySelectedIds.add(p.id));
      else filtered.forEach((p) => inventorySelectedIds.delete(p.id));
      renderInventoryTable();
    });
  }
  tbody.querySelectorAll('input[data-select]').forEach((cb) =>
    cb.addEventListener('change', () => {
      const id = Number(cb.dataset.select);
      if (cb.checked) inventorySelectedIds.add(id);
      else inventorySelectedIds.delete(id);
      updateStickerToolbarButton();
      if (selectAllCb) selectAllCb.checked = filtered.every((p) => inventorySelectedIds.has(p.id));
    })
  );
  tbody.querySelectorAll('button[data-sticker]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = products.find((x) => x.id === Number(b.dataset.sticker));
      openModal({ type: 'sticker-print', products: [p] });
    })
  );
  tbody.querySelectorAll('button[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      location.hash = `office/inventory/${b.dataset.view}`;
    })
  );
  tbody.querySelectorAll('button[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = products.find((x) => x.id === Number(b.dataset.edit));
      openModal({ type: 'product-form', product: p });
    })
  );
  tbody.querySelectorAll('button[data-stock]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = products.find((x) => x.id === Number(b.dataset.stock));
      openModal({ type: 'stock-adjust', product: p });
    })
  );
  tbody.querySelectorAll('button[data-deactivate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const p = products.find((x) => x.id === Number(b.dataset.deactivate));
      if (!confirm(`Deactivate "${p.name}"? It will be hidden from the front desk but sales history is kept.`)) return;
      try {
        await api(`/api/products/${p.id}`, { method: 'DELETE' });
        showToast('Product deactivated');
        await loadProductsAll();
        renderInventoryTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
  tbody.querySelectorAll('button[data-activate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const p = products.find((x) => x.id === Number(b.dataset.activate));
      try {
        await api(`/api/products/${p.id}`, { method: 'PUT', body: { active: true } });
        showToast('Product activated');
        await loadProductsAll();
        renderInventoryTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
  updateStickerToolbarButton();
}

// ---------------- Suppliers ----------------
// Distributor catalogue sync (see server/suppliers/): items land in a review
// queue on sync and only become real products once a person explicitly
// imports them - never auto-created.

async function loadSuppliers() {
  suppliers = await api('/api/suppliers');
}

async function loadCatalogueItems() {
  catalogueItems = await api(`/api/catalogue-items?status=${catalogueStatusFilter}`);
}

async function renderSuppliers() {
  await loadSuppliers();
  await loadCatalogueItems();
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Suppliers</h2>
        <button class="btn btn-primary" id="add-supplier-btn">+ Add supplier</button>
      </div>
      <div class="panel-body">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Adapter</th><th>Last synced</th><th></th></tr></thead>
          <tbody id="supplier-table-body"></tbody>
        </table>
      </div>
    </div>
    <div class="panel" style="margin-top:16px;">
      <div class="panel-header">
        <h2>Review queue</h2>
        <select id="catalogue-status-filter">
          <option value="new" ${catalogueStatusFilter === 'new' ? 'selected' : ''}>New</option>
          <option value="imported" ${catalogueStatusFilter === 'imported' ? 'selected' : ''}>Imported</option>
          <option value="ignored" ${catalogueStatusFilter === 'ignored' ? 'selected' : ''}>Ignored</option>
        </select>
      </div>
      <div class="panel-body">
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>SKU</th><th>Barcode</th><th>Name</th>
                <th class="num">Supplier price</th><th class="num">Stock</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody id="catalogue-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.getElementById('add-supplier-btn').addEventListener('click', () => openModal({ type: 'supplier-form' }));
  document.getElementById('catalogue-status-filter').addEventListener('change', async (e) => {
    catalogueStatusFilter = e.target.value;
    await loadCatalogueItems();
    renderCatalogueTable();
  });
  renderSupplierTable();
  renderCatalogueTable();
}

function renderSupplierTable() {
  const tbody = document.getElementById('supplier-table-body');
  if (!tbody) return;
  if (!suppliers.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No suppliers configured yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = suppliers
    .map(
      (s) => `
      <tr>
        <td>${esc(s.name)}</td>
        <td>${esc(s.adapterType)}</td>
        <td>${s.lastSyncedAt ? fmtDateTime(s.lastSyncedAt) : 'Never'}</td>
        <td>
          <button class="icon-btn" data-edit-supplier="${s.id}">Edit</button>
          <button class="icon-btn" data-sync="${s.id}">Sync now</button>
        </td>
      </tr>
    `
    )
    .join('');
  tbody.querySelectorAll('button[data-edit-supplier]').forEach((b) =>
    b.addEventListener('click', () => {
      const supplier = suppliers.find((s) => s.id === Number(b.dataset.editSupplier));
      openModal({ type: 'supplier-form', supplier });
    })
  );
  tbody.querySelectorAll('button[data-sync]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        const result = await api(`/api/suppliers/${b.dataset.sync}/sync`, { method: 'POST' });
        showToast(`Synced: ${result.inserted} new, ${result.updated} updated`);
        await loadSuppliers();
        await loadCatalogueItems();
        renderSupplierTable();
        renderCatalogueTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

function renderCatalogueTable() {
  const tbody = document.getElementById('catalogue-table-body');
  if (!tbody) return;
  if (!catalogueItems.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Nothing here.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = catalogueItems
    .map(
      (it) => `
      <tr>
        <td>${esc(it.supplierSku)}</td>
        <td>${esc(it.barcode || '—')}</td>
        <td>${esc(it.name)}</td>
        <td class="num">${money(it.price)}</td>
        <td class="num">${it.stockQty}</td>
        <td><span class="badge status-${it.status}">${esc(it.status)}</span></td>
        <td>
          ${
            it.status === 'new'
              ? `<button class="icon-btn" data-import="${it.id}">Import</button>
                 <button class="icon-btn" data-ignore="${it.id}">Ignore</button>`
              : ''
          }
        </td>
      </tr>
    `
    )
    .join('');
  tbody.querySelectorAll('button[data-import]').forEach((b) =>
    b.addEventListener('click', () => {
      const item = catalogueItems.find((x) => x.id === Number(b.dataset.import));
      openModal({ type: 'catalogue-import', item });
    })
  );
  tbody.querySelectorAll('button[data-ignore]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await api(`/api/catalogue-items/${b.dataset.ignore}/ignore`, { method: 'POST' });
        showToast('Item ignored');
        await loadCatalogueItems();
        renderCatalogueTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

// ================= PURCHASE ORDERS =================
// Build an order against a supplier, then book in deliveries against it
// (increasing product stock). Supports partial/split deliveries.

async function loadPurchaseOrders() {
  const qs = poStatusFilter ? `?status=${encodeURIComponent(poStatusFilter)}` : '';
  purchaseOrders = await api(`/api/purchase-orders${qs}`);
}

function poStatusBadgeClass(status) {
  if (status === 'received') return 'ok';
  if (status === 'partially_received') return 'card';
  if (status === 'ordered') return 'split';
  if (status === 'cancelled') return 'low';
  return 'other'; // draft
}

function poStatusLabel(status) {
  return status.replace(/_/g, ' ');
}

function poTotalCost(po) {
  return (po.items || []).reduce((sum, it) => sum + it.qtyOrdered * it.unitCost, 0);
}

async function renderPurchaseOrders() {
  await loadSuppliers();
  await loadPurchaseOrders();
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Purchase orders</h2>
        <div style="display:flex; gap:8px; align-items:center;">
          <select id="po-status-filter">
            <option value="">All statuses</option>
            <option value="draft" ${poStatusFilter === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="ordered" ${poStatusFilter === 'ordered' ? 'selected' : ''}>Ordered</option>
            <option value="partially_received" ${poStatusFilter === 'partially_received' ? 'selected' : ''}>Partially received</option>
            <option value="received" ${poStatusFilter === 'received' ? 'selected' : ''}>Received</option>
            <option value="cancelled" ${poStatusFilter === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
          <button class="btn btn-primary" id="new-po-btn">+ New purchase order</button>
        </div>
      </div>
      <div class="panel-body">
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr><th>#</th><th>Supplier</th><th>Reference</th><th>Status</th><th class="num">Lines</th><th class="num">Total cost</th><th>Created</th></tr>
            </thead>
            <tbody id="po-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.getElementById('new-po-btn').addEventListener('click', () => {
    location.hash = 'office/purchase-orders/new';
  });
  document.getElementById('po-status-filter').addEventListener('change', async (e) => {
    poStatusFilter = e.target.value;
    await loadPurchaseOrders();
    renderPurchaseOrderTable();
  });
  renderPurchaseOrderTable();
}

function renderPurchaseOrderTable() {
  const tbody = document.getElementById('po-table-body');
  if (!tbody) return;
  if (!purchaseOrders.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No purchase orders yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = purchaseOrders
    .map(
      (po) => `
      <tr>
        <td><button class="link-btn" data-view-po="${po.id}">#${po.id}</button></td>
        <td>${esc(po.supplierName)}</td>
        <td>${esc(po.reference || '—')}</td>
        <td><span class="badge ${poStatusBadgeClass(po.status)}">${esc(poStatusLabel(po.status))}</span></td>
        <td class="num">${po.items.length}</td>
        <td class="num">${money(poTotalCost(po))}</td>
        <td>${fmtDateTime(po.createdAt)}</td>
      </tr>
    `
    )
    .join('');
  tbody.querySelectorAll('button[data-view-po]').forEach((b) =>
    b.addEventListener('click', () => {
      location.hash = `office/purchase-orders/${b.dataset.viewPo}`;
    })
  );
}

// ---- Create / edit (draft only) ----

async function renderPurchaseOrderForm(poId) {
  await loadSuppliers();
  await loadProducts();
  let po = null;
  if (poId) {
    po = await api(`/api/purchase-orders/${poId}`);
    if (po.status !== 'draft') {
      // Editing is only possible while a PO is still a draft - land on the
      // detail page instead if it's moved on since the link was clicked.
      location.hash = `office/purchase-orders/${poId}`;
      return;
    }
  }
  poFormItems = po ? po.items.map((it) => ({ productId: it.productId, name: it.name, sku: it.sku, qty: it.qtyOrdered, unitCost: it.unitCost })) : [];
  poFormSearch = '';

  const main = document.getElementById('office-content');
  main.innerHTML = `
    <button class="btn btn-sm" id="back-to-po-list">‹ Back to Purchase Orders</button>
    <div class="panel" style="margin-top:14px;">
      <div class="panel-header"><h2>${po ? `Edit draft PO #${po.id}` : 'New purchase order'}</h2></div>
      <div class="panel-body">
        <div class="field-row">
          <div class="field">
            <label for="po-supplier">Supplier *</label>
            <select id="po-supplier">
              ${suppliers.map((s) => `<option value="${s.id}" ${po && po.supplierId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="po-reference">Reference</label>
            <input id="po-reference" type="text" placeholder="Optional - your own PO number" value="${esc((po && po.reference) || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="po-notes">Notes</label>
          <textarea id="po-notes" rows="2" placeholder="Optional">${esc((po && po.notes) || '')}</textarea>
        </div>

        <div class="field" style="margin-top:10px;">
          <label for="po-product-search">Add a product</label>
          <div class="search-wrap">
            <input type="text" id="po-product-search" class="search-input" placeholder="Search products, SKU or scan barcode…" autocomplete="off" />
            <div class="search-dropdown" id="po-product-dropdown"></div>
          </div>
        </div>

        <table class="data-table" style="margin-top:14px;">
          <thead><tr><th>Product</th><th>SKU</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Line total</th><th></th></tr></thead>
          <tbody id="po-form-items-body"></tbody>
        </table>
      </div>
      <div class="modal-footer" style="padding:16px;">
        <button class="btn btn-primary" id="po-save-btn">${po ? 'Save changes' : 'Save draft'}</button>
      </div>
    </div>
  `;
  document.getElementById('back-to-po-list').addEventListener('click', () => {
    location.hash = po ? `office/purchase-orders/${po.id}` : 'office/purchase-orders';
  });

  const searchInput = document.getElementById('po-product-search');
  searchInput.addEventListener('input', (e) => {
    poFormSearch = e.target.value;
    renderPoProductDropdown();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const matches = getPoProductMatches();
    if (matches.length > 0) addPoFormItem(matches[0]);
  });

  document.getElementById('po-save-btn').addEventListener('click', () => savePurchaseOrder(po));

  renderPoProductDropdown();
  renderPoFormItems();
}

function getPoProductMatches() {
  const term = poFormSearch.trim().toLowerCase();
  if (!term) return [];
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      (p.sku || '').toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term)
  );
}

const PO_DROPDOWN_LIMIT = 8;

function renderPoProductDropdown() {
  const dropdown = document.getElementById('po-product-dropdown');
  if (!dropdown) return;
  if (!poFormSearch.trim()) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    return;
  }
  const matches = getPoProductMatches();
  dropdown.classList.add('open');
  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-empty">No products match.</div>';
    return;
  }
  dropdown.innerHTML = matches
    .slice(0, PO_DROPDOWN_LIMIT)
    .map(
      (p) => `
      <button class="search-dropdown-item" data-add-po-product="${p.id}">
        <span class="sdi-main">
          <span class="sdi-name">${esc(p.name)}</span>
          <span class="sdi-sku">${esc(p.sku || '')}</span>
        </span>
        <span class="sdi-side"><span class="sdi-price">${money(p.cost)} cost</span></span>
      </button>
    `
    )
    .join('');
  dropdown.querySelectorAll('button[data-add-po-product]').forEach((b) =>
    b.addEventListener('click', () => {
      const product = products.find((p) => p.id === Number(b.dataset.addPoProduct));
      if (product) addPoFormItem(product);
    })
  );
}

function addPoFormItem(product) {
  const existing = poFormItems.find((it) => it.productId === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    poFormItems.push({ productId: product.id, name: product.name, sku: product.sku, qty: 1, unitCost: product.cost });
  }
  poFormSearch = '';
  const searchInput = document.getElementById('po-product-search');
  if (searchInput) searchInput.value = '';
  renderPoProductDropdown();
  renderPoFormItems();
}

function renderPoFormItems() {
  const tbody = document.getElementById('po-form-items-body');
  if (!tbody) return;
  if (!poFormItems.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No items added yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = poFormItems
    .map(
      (it, idx) => `
      <tr data-po-item-idx="${idx}">
        <td>${esc(it.name)}</td>
        <td>${esc(it.sku || '—')}</td>
        <td class="num"><input type="number" min="1" step="1" class="po-qty-input" data-qty-idx="${idx}" value="${it.qty}" style="width:70px;" /></td>
        <td class="num">£<input type="number" min="0" step="0.01" class="po-cost-input" data-cost-idx="${idx}" value="${it.unitCost}" style="width:80px;" /></td>
        <td class="num" data-line-total-idx="${idx}">${money(it.qty * it.unitCost)}</td>
        <td><button class="remove-btn" data-remove-po-idx="${idx}" title="Remove">✕</button></td>
      </tr>
    `
    )
    .join('');
  tbody.querySelectorAll('input[data-qty-idx]').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.qtyIdx);
      poFormItems[idx].qty = Math.max(1, Math.trunc(Number(e.target.value)) || 1);
      updatePoLineTotal(idx);
    })
  );
  tbody.querySelectorAll('input[data-cost-idx]').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.costIdx);
      poFormItems[idx].unitCost = Math.max(0, Number(e.target.value) || 0);
      updatePoLineTotal(idx);
    })
  );
  tbody.querySelectorAll('button[data-remove-po-idx]').forEach((b) =>
    b.addEventListener('click', () => {
      poFormItems.splice(Number(b.dataset.removePoIdx), 1);
      renderPoFormItems();
    })
  );
}

function updatePoLineTotal(idx) {
  const cell = document.querySelector(`[data-line-total-idx="${idx}"]`);
  if (cell) cell.textContent = money(poFormItems[idx].qty * poFormItems[idx].unitCost);
}

async function savePurchaseOrder(existingPo) {
  if (!poFormItems.length) return showToast('Add at least one item first');
  const body = {
    supplierId: Number(document.getElementById('po-supplier').value),
    reference: document.getElementById('po-reference').value.trim(),
    notes: document.getElementById('po-notes').value.trim(),
    items: poFormItems.map((it) => ({ productId: it.productId, qty: it.qty, unitCost: it.unitCost })),
  };
  try {
    const saved = existingPo
      ? await api(`/api/purchase-orders/${existingPo.id}`, { method: 'PUT', body })
      : await api('/api/purchase-orders', { method: 'POST', body });
    showToast(existingPo ? 'Purchase order updated' : 'Purchase order created');
    location.hash = `office/purchase-orders/${saved.id}`;
  } catch (err) {
    showToast(err.message);
  }
}

// ---- Detail / receiving ----

async function renderPurchaseOrderDetail(id) {
  const main = document.getElementById('office-content');
  let po;
  try {
    po = await api(`/api/purchase-orders/${id}`);
  } catch (err) {
    main.innerHTML = `
      <button class="btn btn-sm" id="back-to-po-list">‹ Back to Purchase Orders</button>
      <div class="empty-state" style="margin-top:14px;">Purchase order not found.</div>
    `;
    document.getElementById('back-to-po-list').addEventListener('click', () => { location.hash = 'office/purchase-orders'; });
    return;
  }

  const itemsHtml = po.items
    .map(
      (it) => `
      <tr>
        <td>${esc(it.name)}</td>
        <td>${esc(it.sku || '—')}</td>
        <td class="num">${it.qtyOrdered}</td>
        <td class="num">${it.qtyReceived}</td>
        <td class="num">${it.outstanding}</td>
        <td class="num">${money(it.unitCost)}</td>
        <td class="num">${money(it.qtyOrdered * it.unitCost)}</td>
      </tr>
    `
    )
    .join('');

  const canEdit = po.status === 'draft';
  const canReceive = po.status === 'ordered' || po.status === 'partially_received';
  const canCancel = ['draft', 'ordered'].includes(po.status) && po.items.every((it) => it.qtyReceived === 0);

  main.innerHTML = `
    <button class="btn btn-sm" id="back-to-po-list">‹ Back to Purchase Orders</button>
    <div class="panel" style="margin-top:14px;">
      <div class="panel-header">
        <h2>PO #${po.id} <span class="badge ${poStatusBadgeClass(po.status)}">${esc(poStatusLabel(po.status))}</span></h2>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${canEdit ? `<button class="btn" id="po-edit-btn">Edit</button>` : ''}
          ${canEdit ? `<button class="btn btn-primary" id="po-mark-ordered-btn">Mark as ordered</button>` : ''}
          ${canReceive ? `<button class="btn btn-primary" id="po-receive-btn">Receive delivery</button>` : ''}
          ${canCancel ? `<button class="btn btn-danger" id="po-cancel-btn">Cancel</button>` : ''}
        </div>
      </div>
      <div class="panel-body">
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Supplier</span><span class="detail-value">${esc(po.supplierName)}</span></div>
          <div class="detail-item"><span class="detail-label">Reference</span><span class="detail-value">${esc(po.reference || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Created</span><span class="detail-value">${fmtDateTime(po.createdAt)}</span></div>
          <div class="detail-item"><span class="detail-label">Ordered</span><span class="detail-value">${po.orderedAt ? fmtDateTime(po.orderedAt) : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Total cost</span><span class="detail-value">${money(poTotalCost(po))}</span></div>
        </div>
        ${po.notes ? `<p class="muted" style="margin-top:14px;">${esc(po.notes)}</p>` : ''}
        <div style="overflow-x:auto; margin-top:14px;">
          <table class="data-table">
            <thead>
              <tr><th>Product</th><th>SKU</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Outstanding</th><th class="num">Unit cost</th><th class="num">Line total</th></tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-to-po-list').addEventListener('click', () => { location.hash = 'office/purchase-orders'; });
  const editBtn = document.getElementById('po-edit-btn');
  if (editBtn) editBtn.addEventListener('click', () => { location.hash = `office/purchase-orders/${po.id}/edit`; });
  const markOrderedBtn = document.getElementById('po-mark-ordered-btn');
  if (markOrderedBtn) {
    markOrderedBtn.addEventListener('click', async () => {
      try {
        await api(`/api/purchase-orders/${po.id}/mark-ordered`, { method: 'POST' });
        showToast('Marked as ordered');
        await renderPurchaseOrderDetail(po.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  }
  const receiveBtn = document.getElementById('po-receive-btn');
  if (receiveBtn) receiveBtn.addEventListener('click', () => openModal({ type: 'po-receive', po }));
  const cancelBtn = document.getElementById('po-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (!confirm(`Cancel PO #${po.id}? This can't be undone.`)) return;
      try {
        await api(`/api/purchase-orders/${po.id}/cancel`, { method: 'POST' });
        showToast('Purchase order cancelled');
        await renderPurchaseOrderDetail(po.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  }
}

function renderPoReceiveModal(holder, po) {
  const outstandingItems = po.items.filter((it) => it.outstanding > 0);
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>Receive delivery — PO #${po.id}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="po-receive-form">
          <div class="modal-body">
            <p class="muted">Enter how many of each item actually arrived. Defaults to the full outstanding amount - reduce it if this is a partial delivery.</p>
            <table class="data-table">
              <thead><tr><th>Product</th><th class="num">Outstanding</th><th class="num">Receiving now</th></tr></thead>
              <tbody>
                ${outstandingItems
                  .map(
                    (it) => `
                  <tr>
                    <td>${esc(it.name)}</td>
                    <td class="num">${it.outstanding}</td>
                    <td class="num"><input type="number" min="0" max="${it.outstanding}" step="1" class="po-receive-input" data-receive-item="${it.id}" value="${it.outstanding}" style="width:80px;" /></td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Book in</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('po-receive-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = Array.from(document.querySelectorAll('input[data-receive-item]'))
      .map((inp) => ({ itemId: Number(inp.dataset.receiveItem), qtyReceived: Math.trunc(Number(inp.value)) || 0 }))
      .filter((it) => it.qtyReceived > 0);
    if (!items.length) return showToast('Enter at least one quantity to receive');
    try {
      await api(`/api/purchase-orders/${po.id}/receive`, { method: 'POST', body: { items } });
      showToast('Delivery booked in');
      closeModal();
      await renderPurchaseOrderDetail(po.id);
    } catch (err) {
      showToast(err.message);
    }
  });
}

// Refreshes whichever Stockroom view is currently on screen (list or detail)
// after an edit/stock change, since both share the product-form/stock-adjust modals.
async function refreshInventoryView(productId) {
  await loadProductsAll();
  if (document.getElementById('inv-table-body')) {
    renderInventoryTable();
  } else if (document.getElementById('product-detail-page')) {
    await renderProductDetail(productId);
  }
}

async function renderProductDetail(id) {
  if (!products.length) await loadProductsAll();
  let product = products.find((p) => p.id === id);
  if (!product) {
    await loadProductsAll();
    product = products.find((p) => p.id === id);
  }

  const main = document.getElementById('office-content');
  if (!product) {
    main.innerHTML = `
      <button class="btn btn-sm" id="back-to-stockroom">‹ Back to Stockroom</button>
      <div class="empty-state" style="margin-top:14px;">Product not found.</div>
    `;
    document.getElementById('back-to-stockroom').addEventListener('click', () => {
      location.hash = 'office/inventory';
    });
    return;
  }

  const netPrice = product.price / 1.2;
  const vat = product.price - netPrice;
  const margin = netPrice > 0 ? ((netPrice - product.cost) / netPrice) * 100 : null;
  const low = product.category !== 'Services' && product.stockQty <= product.lowStockThreshold;

  main.innerHTML = `
    <div id="product-detail-page">
      <button class="btn btn-sm" id="back-to-stockroom">‹ Back to Stockroom</button>
      <div class="panel" style="margin-top:14px;">
        <div class="panel-header">
          <h2>${esc(product.name)} ${!product.active ? '<span class="badge low">Inactive</span>' : ''}</h2>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" id="pd-edit-btn">Edit</button>
            ${product.category !== 'Services' ? `<button class="btn" id="pd-stock-btn">Adjust stock</button>` : ''}
            ${product.active ? `<button class="btn btn-danger" id="pd-deactivate-btn">Deactivate</button>` : `<button class="btn" id="pd-activate-btn">Activate</button>`}
          </div>
        </div>
        <div class="panel-body">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">SKU</span><span class="detail-value">${esc(product.sku || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Barcode</span><span class="detail-value">${esc(product.barcode || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Category</span><span class="detail-value">${esc(product.category)}</span></div>
            <div class="detail-item"><span class="detail-label">Price (inc. VAT)</span><span class="detail-value">${money(product.price)}</span></div>
            <div class="detail-item"><span class="detail-label">Cost</span><span class="detail-value">${money(product.cost)}</span></div>
            <div class="detail-item"><span class="detail-label">VAT (20%)</span><span class="detail-value">${money(vat)}</span></div>
            <div class="detail-item"><span class="detail-label">Margin</span><span class="detail-value">${margin === null ? '—' : `<span class="badge ${margin < 20 ? 'low' : 'ok'}">${margin.toFixed(1)}%</span>`}</span></div>
            <div class="detail-item"><span class="detail-label">Stock</span><span class="detail-value">${product.category === 'Services' ? '—' : `<span class="badge ${low ? 'low' : 'ok'}">${product.stockQty}</span>`}</span></div>
            <div class="detail-item"><span class="detail-label">Low stock alert at</span><span class="detail-value">${product.lowStockThreshold}</span></div>
            <div class="detail-item"><span class="detail-label">Supplier</span><span class="detail-value">${esc(product.supplier || '—')}</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-to-stockroom').addEventListener('click', () => {
    location.hash = 'office/inventory';
  });
  document.getElementById('pd-edit-btn').addEventListener('click', () => openModal({ type: 'product-form', product }));
  const stockBtn = document.getElementById('pd-stock-btn');
  if (stockBtn) stockBtn.addEventListener('click', () => openModal({ type: 'stock-adjust', product }));
  const deactivateBtn = document.getElementById('pd-deactivate-btn');
  if (deactivateBtn) {
    deactivateBtn.addEventListener('click', async () => {
      if (!confirm(`Deactivate "${product.name}"? It will be hidden from the front desk but sales history is kept.`)) return;
      try {
        await api(`/api/products/${product.id}`, { method: 'DELETE' });
        showToast('Product deactivated');
        await renderProductDetail(product.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  }
  const activateBtn = document.getElementById('pd-activate-btn');
  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      try {
        await api(`/api/products/${product.id}`, { method: 'PUT', body: { active: true } });
        showToast('Product activated');
        await renderProductDetail(product.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  }
}

// ================= SALES HISTORY =================

async function renderSalesHistory() {
  await loadSales();
  await loadActiveCustomers();
  await loadActiveCashiers();
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h2>Sales history</h2></div>
      <div class="panel-body">
        <div class="table-toolbar">
          <select id="sales-date-filter">
            <option value="today" ${salesDateFilter === 'today' ? 'selected' : ''}>Today</option>
            <option value="all" ${salesDateFilter === 'all' ? 'selected' : ''}>All time</option>
          </select>
          <select id="sales-customer-filter">
            <option value="">All customers</option>
            ${customers.map((c) => `<option value="${c.id}" ${salesCustomerFilter === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          <select id="sales-cashier-filter">
            <option value="">All cashiers</option>
            ${activeCashiers.map((c) => `<option value="${c.id}" ${salesCashierFilter === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr><th>#</th><th>Date &amp; time</th><th>Customer</th><th>Cashier</th><th>Items</th><th>Payment</th><th class="num">Total</th><th></th></tr>
            </thead>
            <tbody id="sales-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.getElementById('sales-date-filter').addEventListener('change', async (e) => {
    salesDateFilter = e.target.value;
    await loadSales();
    renderSalesTable();
  });
  document.getElementById('sales-customer-filter').addEventListener('change', async (e) => {
    salesCustomerFilter = e.target.value;
    await loadSales();
    renderSalesTable();
  });
  document.getElementById('sales-cashier-filter').addEventListener('change', async (e) => {
    salesCashierFilter = e.target.value;
    await loadSales();
    renderSalesTable();
  });
  renderSalesTable();
}

function renderSalesTable() {
  const tbody = document.getElementById('sales-table-body');
  if (!tbody) return;
  if (!salesList.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No sales recorded${salesDateFilter === 'today' ? ' today' : ''} yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = salesList
    .map(
      (s) => `
      <tr>
        <td>#${s.id}</td>
        <td>${esc(fmtDateTime(s.createdAt))}</td>
        <td>${esc(s.customerName || '—')}</td>
        <td>${esc(s.cashierName || '—')}</td>
        <td>${s.items ? s.items.length : ''}</td>
        <td><span class="badge ${paymentBadgeClass(s.paymentMethod)}">${esc(s.paymentMethod)}</span></td>
        <td class="num">${money(s.total)}</td>
        <td><button class="icon-btn" data-view="${s.id}">View receipt</button></td>
      </tr>
    `
    )
    .join('');
  tbody.querySelectorAll('button[data-view]').forEach((b) =>
    b.addEventListener('click', async () => {
      const sale = await api(`/api/sales/${b.dataset.view}`);
      openModal({ type: 'receipt', sale, title: `Sale #${sale.id}` });
    })
  );
}

function renderGroupBadges(groups) {
  if (!groups || !groups.length) return '<span class="muted">—</span>';
  return groups.map((g) => `<span class="badge role-cashier">${esc(g.name)}</span>`).join(' ');
}

// ================= CUSTOMERS =================

async function renderCustomers() {
  await loadCustomers();
  await loadCustomerGroups();
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>Customers</h2>
        <button class="btn btn-primary" id="add-customer-btn">+ Add customer</button>
      </div>
      <div class="panel-body">
        <div class="table-toolbar">
          <input type="text" id="cust-search" class="search-input" placeholder="Search name, email or phone…" value="${esc(customerSearch)}" />
          <label style="display:flex;align-items:center;gap:6px;font-size:13.5px;">
            <input type="checkbox" id="cust-show-inactive" ${customerShowInactive ? 'checked' : ''} /> Show deactivated
          </label>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Groups</th><th></th></tr>
            </thead>
            <tbody id="cust-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-customer-btn').addEventListener('click', () => openModal({ type: 'customer-form', customer: null }));
  document.getElementById('cust-search').addEventListener('input', (e) => {
    customerSearch = e.target.value;
    renderCustomerTable();
  });
  document.getElementById('cust-show-inactive').addEventListener('change', async (e) => {
    customerShowInactive = e.target.checked;
    await loadCustomers();
    renderCustomerTable();
  });

  renderCustomerTable();
}

function renderCustomerTable() {
  const tbody = document.getElementById('cust-table-body');
  if (!tbody) return;
  const term = customerSearch.trim().toLowerCase();
  const filtered = customers.filter((c) => {
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term)
    );
  });
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No customers found.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered
    .map((c) => {
      const inactiveTag = !c.active ? ' <span class="badge low">Inactive</span>' : '';
      return `
      <tr>
        <td><button class="link-btn" data-view="${c.id}">${esc(c.name)}</button>${inactiveTag}</td>
        <td>${esc(c.email || '—')}</td>
        <td>${esc(c.phone || '—')}</td>
        <td>${renderGroupBadges(c.groups)}</td>
        <td>
          <button class="icon-btn" data-view-sales="${c.id}">Sales</button>
          <button class="icon-btn" data-edit="${c.id}">Edit</button>
          ${c.active ? `<button class="icon-btn" data-deactivate="${c.id}">Deactivate</button>` : `<button class="icon-btn" data-activate="${c.id}">Activate</button>`}
        </td>
      </tr>
    `;
    })
    .join('');

  tbody.querySelectorAll('button[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      location.hash = `office/customers/${b.dataset.view}`;
    })
  );
  tbody.querySelectorAll('button[data-view-sales]').forEach((b) =>
    b.addEventListener('click', async () => {
      const c = customers.find((x) => x.id === Number(b.dataset.viewSales));
      const sales = await api(`/api/customers/${c.id}/sales`);
      openModal({ type: 'customer-sales', customer: c, sales });
    })
  );
  tbody.querySelectorAll('button[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = customers.find((x) => x.id === Number(b.dataset.edit));
      openModal({ type: 'customer-form', customer: c });
    })
  );
  tbody.querySelectorAll('button[data-deactivate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const c = customers.find((x) => x.id === Number(b.dataset.deactivate));
      if (!confirm(`Deactivate "${c.name}"? Their sales history is kept.`)) return;
      try {
        await api(`/api/customers/${c.id}`, { method: 'DELETE' });
        showToast('Customer deactivated');
        await loadCustomers();
        renderCustomerTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
  tbody.querySelectorAll('button[data-activate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const c = customers.find((x) => x.id === Number(b.dataset.activate));
      try {
        await api(`/api/customers/${c.id}`, { method: 'PUT', body: { active: true } });
        showToast('Customer activated');
        await loadCustomers();
        renderCustomerTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

// Refreshes whichever Customers view is currently on screen (list or detail)
// after an edit, since both share the customer-form modal.
async function refreshCustomerView(customerId) {
  await loadCustomers();
  if (document.getElementById('cust-table-body')) {
    renderCustomerTable();
  } else if (document.getElementById('customer-detail-page')) {
    await renderCustomerDetail(customerId);
  }
}

async function renderCustomerDetail(id) {
  if (!customers.length) await loadCustomers();
  let customer = customers.find((c) => c.id === id);
  if (!customer) {
    try {
      customer = await api(`/api/customers/${id}`);
    } catch (_) {
      customer = null;
    }
  }

  const main = document.getElementById('office-content');
  if (!customer) {
    main.innerHTML = `
      <button class="btn btn-sm" id="back-to-customers">‹ Back to Customers</button>
      <div class="empty-state" style="margin-top:14px;">Customer not found.</div>
    `;
    document.getElementById('back-to-customers').addEventListener('click', () => {
      location.hash = 'office/customers';
    });
    return;
  }

  await loadCustomerBikes(id);
  await loadCustomerGroups();
  await loadCustomerMessages(id);

  main.innerHTML = `
    <div id="customer-detail-page">
      <button class="btn btn-sm" id="back-to-customers">‹ Back to Customers</button>
      <div class="panel" style="margin-top:14px;">
        <div class="panel-header">
          <h2>${esc(customer.name)} ${!customer.active ? '<span class="badge low">Inactive</span>' : ''}</h2>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" id="cd-sales-btn">Sales</button>
            <button class="btn" id="cd-edit-btn">Edit</button>
            ${customer.active ? `<button class="btn btn-danger" id="cd-deactivate-btn">Deactivate</button>` : `<button class="btn" id="cd-activate-btn">Activate</button>`}
          </div>
        </div>
        <div class="panel-body">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Email</span><span class="detail-value">${esc(customer.email || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Phone</span><span class="detail-value">${esc(customer.phone || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Notes</span><span class="detail-value">${esc(customer.notes || '—')}</span></div>
            <div class="detail-item"><span class="detail-label">Groups</span><span class="detail-value">${renderGroupBadges(customer.groups)}</span></div>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px;">
        <div class="panel-header">
          <h2>Bikes</h2>
          <button class="btn btn-primary" id="add-bike-btn">+ Add bike</button>
        </div>
        <div class="panel-body">
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr><th>Make</th><th>Model</th><th>Colour</th><th>Serial number</th><th></th></tr>
              </thead>
              <tbody id="bike-table-body"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px;">
        <div class="panel-header">
          <h2>Messages</h2>
          <button class="btn btn-primary" id="send-text-btn">+ Send text</button>
        </div>
        <div class="panel-body">
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr><th>Date</th><th>Status</th><th>Message</th><th>Sent by</th></tr>
              </thead>
              <tbody id="message-table-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-to-customers').addEventListener('click', () => {
    location.hash = 'office/customers';
  });
  document.getElementById('send-text-btn').addEventListener('click', () => openModal({ type: 'customer-sms', customer }));
  document.getElementById('cd-sales-btn').addEventListener('click', async () => {
    const sales = await api(`/api/customers/${customer.id}/sales`);
    openModal({ type: 'customer-sales', customer, sales });
  });
  document.getElementById('cd-edit-btn').addEventListener('click', () => openModal({ type: 'customer-form', customer }));
  const deactivateBtn = document.getElementById('cd-deactivate-btn');
  if (deactivateBtn) {
    deactivateBtn.addEventListener('click', async () => {
      if (!confirm(`Deactivate "${customer.name}"? Their sales history is kept.`)) return;
      try {
        await api(`/api/customers/${customer.id}`, { method: 'DELETE' });
        showToast('Customer deactivated');
        await renderCustomerDetail(customer.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  }
  const activateBtn = document.getElementById('cd-activate-btn');
  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      try {
        await api(`/api/customers/${customer.id}`, { method: 'PUT', body: { active: true } });
        showToast('Customer activated');
        await renderCustomerDetail(customer.id);
      } catch (err) {
        showToast(err.message);
      }
    });
  }
  document.getElementById('add-bike-btn').addEventListener('click', () => {
    openModal({ type: 'bike-form', bike: null, customerId: customer.id });
  });

  renderBikeTable(customer.id);
  renderMessageTable();
}

function smsStatusBadgeClass(status) {
  return status === 'sent' ? 'ok' : 'low';
}

function renderMessageTable() {
  const tbody = document.getElementById('message-table-body');
  if (!tbody) return;
  if (!customerMessages.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No texts sent yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = customerMessages
    .map(
      (m) => `
      <tr>
        <td>${fmtDateTime(m.createdAt)}</td>
        <td>
          <span class="badge ${smsStatusBadgeClass(m.status)}">${esc(m.status)}</span>
          ${m.status === 'failed' && m.error ? `<div class="muted" style="font-size:12px;">${esc(m.error)}</div>` : ''}
        </td>
        <td>${esc(m.body)}</td>
        <td>${esc(m.sentByName || '—')}</td>
      </tr>
    `
    )
    .join('');
}

function renderBikeTable(customerId) {
  const tbody = document.getElementById('bike-table-body');
  if (!tbody) return;
  if (!customerBikes.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No bikes on file yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = customerBikes
    .map(
      (bike) => `
      <tr>
        <td><button class="link-btn" data-history="${bike.id}">${esc(bike.make || '—')}</button></td>
        <td>${esc(bike.model || '—')}</td>
        <td>${esc(bike.colour || '—')}</td>
        <td>${esc(bike.serialNumber || '—')}</td>
        <td>
          <button class="icon-btn" data-history="${bike.id}">Service history</button>
          <button class="icon-btn" data-edit="${bike.id}">Edit</button>
          <button class="icon-btn" data-deactivate="${bike.id}">Remove</button>
        </td>
      </tr>
    `
    )
    .join('');

  tbody.querySelectorAll('button[data-history]').forEach((b) =>
    b.addEventListener('click', async () => {
      const bike = customerBikes.find((x) => x.id === Number(b.dataset.history));
      const jobs = await api(`/api/bikes/${bike.id}/jobs`);
      openModal({ type: 'bike-service', bike, jobs });
    })
  );
  tbody.querySelectorAll('button[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const bike = customerBikes.find((x) => x.id === Number(b.dataset.edit));
      openModal({ type: 'bike-form', bike, customerId });
    })
  );
  tbody.querySelectorAll('button[data-deactivate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const bike = customerBikes.find((x) => x.id === Number(b.dataset.deactivate));
      const label = `${bike.make} ${bike.model}`.trim() || 'this bike';
      if (!confirm(`Remove "${esc(label)}" from this customer's profile? Its service history is kept.`)) return;
      try {
        await api(`/api/bikes/${bike.id}`, { method: 'DELETE' });
        showToast('Bike removed');
        await loadCustomerBikes(customerId);
        renderBikeTable(customerId);
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

// ================= QUOTES & ORDERS =================

function docStatusBadgeClass(status) {
  if (status === 'open') return 'ok';
  if (status === 'converted') return 'cash';
  return 'low';
}

function paymentBadgeClass(method) {
  if (method === 'Cash') return 'cash';
  if (method === 'Card') return 'card';
  if (method === 'Split') return 'split';
  return 'other';
}

// ================= EDIT FRONT DESK =================

async function renderEditFrontDesk() {
  await loadCustomerGroups();
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <h1>Edit Front Desk</h1>
    <div class="panel" style="margin-top:14px;">
      <div class="panel-header">
        <h2>Customer groups</h2>
        <button class="btn btn-primary" id="add-group-btn">+ Add group</button>
      </div>
      <div class="panel-body">
        <p class="muted" style="margin:0 0 12px;">Tag customers with a group (e.g. a discount scheme or membership) from the customer edit page. A group with a discount is applied automatically to the sale subtotal whenever a customer with that group is selected on Front Desk.</p>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Discount</th><th></th></tr></thead>
          <tbody id="group-table-body"></tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('add-group-btn').addEventListener('click', () => {
    openModal({ type: 'group-form', group: null });
  });
  renderGroupTable();
}

function renderGroupTable() {
  const tbody = document.getElementById('group-table-body');
  if (!tbody) return;
  if (!customerGroups.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">No groups yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = customerGroups
    .map(
      (g) => `
    <tr>
      <td>${esc(g.name)}</td>
      <td>${g.discountPercent ? `${g.discountPercent}%` : '<span class="muted">—</span>'}</td>
      <td>
        <button class="icon-btn" data-edit="${g.id}">Edit</button>
        <button class="icon-btn" data-delete="${g.id}">Delete</button>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('button[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = customerGroups.find((x) => x.id === Number(b.dataset.edit));
      openModal({ type: 'group-form', group: g });
    })
  );
  tbody.querySelectorAll('button[data-delete]').forEach((b) =>
    b.addEventListener('click', async () => {
      const g = customerGroups.find((x) => x.id === Number(b.dataset.delete));
      if (!confirm(`Delete the "${g.name}" group? It will be removed from every customer who has it.`)) return;
      try {
        await api(`/api/customer-groups/${g.id}`, { method: 'DELETE' });
        showToast('Group deleted');
        await loadCustomerGroups();
        renderGroupTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

function renderGroupFormModal(holder, group) {
  const isEdit = !!group;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit group' : 'Add group'}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="group-form">
          <div class="modal-body">
            <div class="field">
              <label for="group-name">Name *</label>
              <input id="group-name" type="text" required value="${esc(group?.name || '')}" />
            </div>
            <div class="field">
              <label for="group-discount">Discount %</label>
              <input id="group-discount" type="number" min="0" max="100" step="0.1" value="${group?.discountPercent || 0}" />
              <p class="muted" style="margin:4px 0 0;">Applied automatically to the sale subtotal on Front Desk whenever the selected customer has this group. 0 = no automatic discount.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Add group'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name').value.trim();
    const discountPercent = Number(document.getElementById('group-discount').value) || 0;
    try {
      if (isEdit) {
        await api(`/api/customer-groups/${group.id}`, { method: 'PUT', body: { name, discountPercent } });
      } else {
        await api('/api/customer-groups', { method: 'POST', body: { name, discountPercent } });
      }
      showToast(isEdit ? 'Group updated' : 'Group added');
      closeModal();
      await loadCustomerGroups();
      renderGroupTable();
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ================= EMPLOYEE LOGINS =================
// Who can sign in to the app at all - separate from the Front Desk/Workshop
// "employees" roster above, which just attributes sales and jobs to a name
// and isn't tied to login yet.

async function loadTeamLogins() {
  teamLogins = await api('/api/auth/team');
}

async function renderEmployeeLogins() {
  await loadTeamLogins();
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <h1>Employee Logins</h1>
    <div class="panel" style="margin-top:14px;">
      <div class="panel-header">
        <h2>Who can sign in</h2>
        <button class="btn btn-primary" id="add-login-btn">+ Add employee login</button>
      </div>
      <div class="panel-body">
        <p class="muted" style="margin:0 0 12px;">Every login can do everything for now - individual permissions are coming later.</p>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody id="login-table-body"></tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('add-login-btn').addEventListener('click', () => {
    openModal({ type: 'login-form' });
  });
  renderLoginTable();
}

function renderLoginTable() {
  const tbody = document.getElementById('login-table-body');
  if (!tbody) return;
  if (!teamLogins.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">No logins yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = teamLogins
    .map((l) => {
      const inactiveTag = !l.active ? ' <span class="badge low">Inactive</span>' : '';
      const roleBadge = l.isOwner ? '<span class="badge role-mechanic">Owner</span>' : '<span class="muted">Employee</span>';
      const action = l.isOwner
        ? ''
        : l.active
          ? `<button class="icon-btn" data-deactivate="${l.id}">Deactivate</button>`
          : `<button class="icon-btn" data-activate="${l.id}">Activate</button>`;
      return `
      <tr>
        <td>${esc(l.name)}${inactiveTag}</td>
        <td>${esc(l.email)}</td>
        <td>${roleBadge}</td>
        <td>${action}</td>
      </tr>
    `;
    })
    .join('');

  tbody.querySelectorAll('button[data-deactivate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const l = teamLogins.find((x) => x.id === Number(b.dataset.deactivate));
      if (!confirm(`Deactivate the login for "${l.name}"? They won't be able to sign in until reactivated.`)) return;
      try {
        await api(`/api/auth/team/${l.id}`, { method: 'PUT', body: { active: false } });
        showToast('Login deactivated');
        await loadTeamLogins();
        renderLoginTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
  tbody.querySelectorAll('button[data-activate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const l = teamLogins.find((x) => x.id === Number(b.dataset.activate));
      try {
        await api(`/api/auth/team/${l.id}`, { method: 'PUT', body: { active: true } });
        showToast('Login activated');
        await loadTeamLogins();
        renderLoginTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

function renderLoginFormModal(holder) {
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>Add employee login</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="login-form">
          <div class="modal-body">
            <div class="field">
              <label for="login-name">Name *</label>
              <input id="login-name" type="text" required />
            </div>
            <div class="field">
              <label for="login-email">Email *</label>
              <input id="login-email" type="email" required autocomplete="off" />
            </div>
            <div class="field">
              <label for="login-password">Password *</label>
              <input id="login-password" type="password" required minlength="8" autocomplete="new-password" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Add login</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('login-name').value.trim(),
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value,
    };
    try {
      await api('/api/auth/team', { method: 'POST', body });
      showToast('Employee login added');
      closeModal();
      await loadTeamLogins();
      renderLoginTable();
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ================= EDIT WORKSHOP =================

const HOUR_OPTIONS = [...Array(24)].map((_, h) => `${String(h).padStart(2, '0')}:00`);
// Monday-first order matching how the diary lays out the week; values match
// JS Date.getDay() (0 = Sunday) so a day column's weekday can be checked directly.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

const FULL_DAY_THRESHOLD_OPTIONS = [0, 30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];
function fmtMinutesLabel(m) {
  if (m === 0) return 'Never (off)';
  if (m < 60) return `${m} minutes`;
  const h = m / 60;
  return `${h} hour${h === 1 ? '' : 's'}`;
}

const JOB_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending approval' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'waiting_parts', label: 'Waiting for parts' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'complete', label: 'Complete' },
];
const JOB_STATUS_LABELS = Object.fromEntries(JOB_STATUS_OPTIONS.map((s) => [s.value, s.label]));
const JOB_STATUS_SELECT_OPTIONS = JOB_STATUS_OPTIONS.filter((s) => s.value !== 'complete');

async function renderEditWorkshop() {
  await loadWorkshopSettings();
  await loadEmployees();

  const main = document.getElementById('office-content');
  main.innerHTML = `
    <h1>Edit Workshop</h1>
    <div class="panel" style="margin-top:14px;">
      <div class="panel-header"><h2>Opening hours &amp; days</h2></div>
      <div class="panel-body">
        <div class="field-row" style="align-items:flex-end;">
          <div class="field">
            <label for="ws-opening">Opens</label>
            <select id="ws-opening">
              ${HOUR_OPTIONS.map((h) => `<option value="${h}" ${workshopSettings.openingTime === h ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="ws-closing">Closes</label>
            <select id="ws-closing">
              ${HOUR_OPTIONS.map((h) => `<option value="${h}" ${workshopSettings.closingTime === h ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="muted" style="margin:0 0 12px;">Controls the time range shown on the Workshop diary.</p>
        <div class="field">
          <label>Opening days</label>
          <div class="weekday-picker">
            ${WEEKDAY_ORDER.map(
              (d) => `
              <label class="weekday-check">
                <input type="checkbox" data-ws-day="${d}" ${workshopSettings.openingDays.includes(d) ? 'checked' : ''} />
                ${WEEKDAY_LABELS[d]}
              </label>
            `
            ).join('')}
          </div>
          <p class="muted" style="margin:6px 0 0;">On unchecked days, every mechanic's diary is greyed out and can't have jobs assigned, regardless of their own working days.</p>
        </div>
        <div class="field" style="margin-top:14px;max-width:220px;">
          <label for="ws-full-threshold">Treat a day as full once less than this much time is left</label>
          <select id="ws-full-threshold">
            ${FULL_DAY_THRESHOLD_OPTIONS.map(
              (m) => `<option value="${m}" ${workshopSettings.fullDayThresholdMinutes === m ? 'selected' : ''}>${fmtMinutesLabel(m)}</option>`
            ).join('')}
          </select>
          <p class="muted" style="margin:6px 0 0;">Once a mechanic's genuinely free time that day (small gaps between jobs merged, not summed twice) drops below this, the online booking portal shows that whole day as full for them - even if a technically-bookable sliver remains.</p>
        </div>
        <button class="btn btn-primary" id="ws-save-hours" style="margin-top:14px;">Save</button>
      </div>
    </div>

    <div class="panel" style="margin-top:16px;">
      <div class="panel-header">
        <h2>Employees</h2>
        <button class="btn btn-primary" id="add-employee-btn">+ Add employee</button>
      </div>
      <div class="panel-body">
        <p class="muted" style="margin:0 0 12px;">Every mechanic and cashier is an employee - tick the roles that apply to each person. A mechanic gets their own diary; a cashier can be selected on Front Desk.</p>
        <label style="display:flex;align-items:center;gap:6px;font-size:13.5px;margin-bottom:12px;">
          <input type="checkbox" id="employee-show-inactive" ${employeeShowInactive ? 'checked' : ''} /> Show removed
        </label>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Roles</th><th></th></tr></thead>
          <tbody id="employee-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('ws-save-hours').addEventListener('click', async () => {
    const openingTime = document.getElementById('ws-opening').value;
    const closingTime = document.getElementById('ws-closing').value;
    const openingDays = [...document.querySelectorAll('[data-ws-day]:checked')].map((cb) => Number(cb.dataset.wsDay));
    const fullDayThresholdMinutes = Number(document.getElementById('ws-full-threshold').value);
    try {
      await api('/api/workshop-settings', { method: 'PUT', body: { openingTime, closingTime, openingDays, fullDayThresholdMinutes } });
      showToast('Opening hours & days updated');
      await loadWorkshopSettings();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('add-employee-btn').addEventListener('click', () => {
    openModal({ type: 'employee-form', employee: null });
  });
  document.getElementById('employee-show-inactive').addEventListener('change', async (e) => {
    employeeShowInactive = e.target.checked;
    await loadEmployees();
    renderEmployeeTable();
  });

  renderEmployeeTable();
}

async function renderEditColours() {
  const main = document.getElementById('office-content');
  main.innerHTML = `
    <h1>Colours</h1>
    <div class="panel" style="margin-top:14px;">
      <div class="panel-header"><h2>Colour scheme</h2></div>
      <div class="panel-body">
        <p class="muted" style="margin:0 0 14px;">Sets the top bar colour and every popup's background across the whole app. Click a scheme to switch straight away.</p>
        <div class="theme-swatch-grid" id="theme-swatch-grid"></div>
      </div>
    </div>
  `;
  renderThemeSwatchGrid();
}

function renderThemeSwatchGrid() {
  const grid = document.getElementById('theme-swatch-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(THEME_PRESETS)
    .map(
      ([key, preset]) => `
      <button type="button" class="theme-swatch ${shopThemePreset === key ? 'active' : ''}" data-preset="${key}">
        <span class="theme-swatch-preview" style="background:${preset.modalBg};">
          <span class="theme-swatch-bar" style="background:${preset.topbar};"></span>
          <span class="theme-swatch-accent-dot" style="background:${preset.accent};"></span>
        </span>
        <span class="theme-swatch-name">${esc(preset.name)}</span>
      </button>
    `
    )
    .join('');
  grid.querySelectorAll('button[data-preset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const preset = btn.dataset.preset;
      try {
        await api('/api/shop-theme', { method: 'PUT', body: { preset } });
        applyShopTheme(preset);
        showToast(`Switched to ${THEME_PRESETS[preset].name}`);
        renderThemeSwatchGrid();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

function renderEmployeeTable() {
  const tbody = document.getElementById('employee-table-body');
  if (!tbody) return;
  if (!employees.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">No employees added yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = employees
    .map((e) => {
      const inactiveTag = !e.active ? ' <span class="badge low">Inactive</span>' : '';
      const roles = [e.isMechanic ? '<span class="badge role-mechanic">Mechanic</span>' : '', e.isCashier ? '<span class="badge role-cashier">Cashier</span>' : '']
        .filter(Boolean)
        .join(' ');
      return `
      <tr>
        <td>${esc(e.name)}${inactiveTag}</td>
        <td>${roles || '<span class="muted">—</span>'}</td>
        <td>
          <button class="icon-btn" data-edit="${e.id}">Edit</button>
          ${e.active ? `<button class="icon-btn" data-deactivate="${e.id}">Deactivate</button>` : `<button class="icon-btn" data-activate="${e.id}">Activate</button>`}
          <button class="icon-btn" data-delete="${e.id}">Delete</button>
        </td>
      </tr>
    `;
    })
    .join('');

  tbody.querySelectorAll('button[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const e = employees.find((x) => x.id === Number(b.dataset.edit));
      openModal({ type: 'employee-form', employee: e });
    })
  );
  tbody.querySelectorAll('button[data-deactivate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const e = employees.find((x) => x.id === Number(b.dataset.deactivate));
      if (!confirm(`Deactivate "${e.name}"? Their diary and job history are kept, and they'll no longer appear as an option for new jobs or sales.`)) return;
      try {
        await api(`/api/employees/${e.id}`, { method: 'DELETE' });
        showToast('Employee deactivated');
        await loadEmployees();
        renderEmployeeTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
  tbody.querySelectorAll('button[data-activate]').forEach((b) =>
    b.addEventListener('click', async () => {
      const e = employees.find((x) => x.id === Number(b.dataset.activate));
      try {
        await api(`/api/employees/${e.id}`, { method: 'PUT', body: { active: true } });
        showToast('Employee activated');
        await loadEmployees();
        renderEmployeeTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
  tbody.querySelectorAll('button[data-delete]').forEach((b) =>
    b.addEventListener('click', async () => {
      const e = employees.find((x) => x.id === Number(b.dataset.delete));
      if (!confirm(`Permanently delete "${e.name}"? This cannot be undone. Any workshop jobs or sales tied to them will become unassigned.`)) return;
      try {
        await api(`/api/employees/${e.id}/permanent`, { method: 'DELETE' });
        showToast('Employee permanently deleted');
        await loadEmployees();
        renderEmployeeTable();
      } catch (err) {
        showToast(err.message);
      }
    })
  );
}

// ================= DASHBOARD =================

async function renderDashboard() {
  await loadDashboard();
  const main = document.getElementById('office-content');
  const d = dashboardData;
  main.innerHTML = `
    <h1>Dashboard</h1>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Today's sales</div><div class="value">${money(d.todayTotal)}</div></div>
      <div class="stat-card"><div class="label">Transactions today</div><div class="value">${d.todayCount}</div></div>
      <div class="stat-card"><div class="label">Low stock items</div><div class="value">${d.lowStock.length}</div></div>
    </div>
    <div class="two-col">
      <div class="panel">
        <div class="panel-header"><h2>Low stock</h2></div>
        <div class="panel-body">
          ${
            d.lowStock.length
              ? `<table class="data-table"><thead><tr><th>Product</th><th>Category</th><th class="num">Stock</th><th class="num">Threshold</th></tr></thead><tbody>
                ${d.lowStock
                  .map(
                    (p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td class="num"><span class="badge low">${p.stockQty}</span></td><td class="num">${p.lowStockThreshold}</td></tr>`
                  )
                  .join('')}
              </tbody></table>`
              : `<div class="empty-state">Nothing is low on stock right now.</div>`
          }
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Top sellers today</h2></div>
        <div class="panel-body">
          ${
            d.topToday.length
              ? `<table class="data-table"><thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Revenue</th></tr></thead><tbody>
                ${d.topToday.map((t) => `<tr><td>${esc(t.name)}</td><td class="num">${t.qty}</td><td class="num">${money(t.revenue)}</td></tr>`).join('')}
              </tbody></table>`
              : `<div class="empty-state">No sales yet today.</div>`
          }
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px;">
      <div class="panel-header"><h2>Connected printers</h2></div>
      <div class="panel-body">
        ${
          printAgents.length
            ? `<div class="printer-agent-list">
              ${printAgents
                .map(
                  (a) => `
                <div class="printer-agent">
                  <div class="printer-agent-name">${esc(a.deviceName)}</div>
                  <div class="printer-agent-printers">
                    ${
                      a.printers.length
                        ? a.printers.map((p) => `<span class="badge ok">${esc(p)}</span>`).join('')
                        : `<span class="muted">No printers detected</span>`
                    }
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
            : `<div class="empty-state">No print agents currently online. Install and sign in to one on a shop PC to see it here - see the Print Stickers modal in Stockroom.</div>`
        }
      </div>
    </div>
  `;
}

// ================= MODALS =================

function openModal(payload) {
  modal = payload;
  renderModal();
}

function closeModal() {
  modal = null;
  const holder = document.getElementById('modal-holder');
  if (holder) holder.innerHTML = '';
}

function ensureModalHolder() {
  let holder = document.getElementById('modal-holder');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'modal-holder';
    document.body.appendChild(holder);
  }
  return holder;
}

function renderModal() {
  const holder = ensureModalHolder();
  if (!modal) {
    holder.innerHTML = '';
    return;
  }
  if (modal.type === 'product-form') return renderProductFormModal(holder, modal.product);
  if (modal.type === 'stock-adjust') return renderStockAdjustModal(holder, modal.product);
  if (modal.type === 'receipt') return renderReceiptModal(holder, modal.sale, modal.title);
  if (modal.type === 'customer-form') return renderCustomerFormModal(holder, modal.customer);
  if (modal.type === 'customer-sales') return renderCustomerSalesModal(holder, modal.customer, modal.sales);
  if (modal.type === 'workshop-job-form') return renderWorkshopJobFormModal(holder, modal.job, modal.defaultDate, modal.prefill, modal.defaultTime, modal.defaultMechanicId, modal.skipAutoOrder);
  if (modal.type === 'document-view') return renderDocumentModal(holder, modal.doc);
  if (modal.type === 'bike-form') return renderBikeFormModal(holder, modal.bike, modal.customerId);
  if (modal.type === 'bike-service') return renderBikeServiceModal(holder, modal.bike, modal.jobs);
  if (modal.type === 'employee-form') return renderEmployeeFormModal(holder, modal.employee);
  if (modal.type === 'login-form') return renderLoginFormModal(holder);
  if (modal.type === 'group-form') return renderGroupFormModal(holder, modal.group);
  if (modal.type === 'day-jobs') return renderDayJobsModal(holder, modal.dateStr, modal.jobs);
  if (modal.type === 'catalogue-import') return renderCatalogueImportModal(holder, modal.item);
  if (modal.type === 'supplier-form') return renderSupplierFormModal(holder, modal.supplier);
  if (modal.type === 'po-receive') return renderPoReceiveModal(holder, modal.po);
  if (modal.type === 'customer-sms') return renderCustomerSmsModal(holder, modal.customer);
  if (modal.type === 'sticker-print') return renderStickerPrintModal(holder, modal.products);
}

function renderStickerPrintModal(holder, products) {
  const rowsHtml = products
    .map((p) => {
      const { svg, note } = stickerBarcode(p, 40, 14);
      return `
      <div class="sticker-row">
        <div class="sticker-row-preview">${svg || `<div class="sticker-no-code muted">${esc(note)}</div>`}</div>
        <div class="sticker-row-info">
          <div class="sticker-row-name">${esc(p.name)}</div>
          <div class="muted">${money(p.price)}${p.barcode || p.sku ? ` · ${esc(p.barcode || p.sku)}` : ''}</div>
        </div>
        <div class="field" style="margin:0;">
          <label for="sticker-qty-${p.id}">Qty</label>
          <input type="number" id="sticker-qty-${p.id}" min="1" value="1" style="width:70px;" />
        </div>
      </div>
    `;
    })
    .join('');

  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal wide">
        <div class="modal-header">
          <h2>Print stickers</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="field-row" style="align-items:flex-end;">
            <div class="field">
              <label for="sticker-width">Label width (mm)</label>
              <input type="number" id="sticker-width" min="10" max="150" step="0.5" value="${labelSettings.widthMm}" />
            </div>
            <div class="field">
              <label for="sticker-height">Label height (mm)</label>
              <input type="number" id="sticker-height" min="10" max="150" step="0.5" value="${labelSettings.heightMm}" />
            </div>
          </div>
          <p class="muted" style="margin:0 0 12px;">Matches your label printer's roll size - saved as the default for next time.</p>
          <div class="field" id="sticker-printer-field" style="display:none;">
            <label for="sticker-printer">Send straight to</label>
            <select id="sticker-printer">
              <option value="">Use the browser's print dialog instead</option>
            </select>
          </div>
          <p class="muted" id="sticker-agent-note" style="margin:0 0 12px;">Looking for the print agent…</p>
          <div class="sticker-row-list">${rowsHtml}</div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="sticker-print-btn">Print</button>
        </div>
      </div>
    </div>
  `;
  wireModalDismiss();

  api('/api/print-agents')
    .then(({ agents }) => {
      const note = document.getElementById('sticker-agent-note');
      const options = agents.flatMap((a) => a.printers.map((printer) => ({ agent: a, printer })));
      if (!options.length) {
        note.textContent = agents.length
          ? "A print agent is signed in, but isn't reporting any printers."
          : "No print agent is signed in - printing will use the browser's print dialog.";
        return;
      }
      note.remove();
      const field = document.getElementById('sticker-printer-field');
      const select = document.getElementById('sticker-printer');
      options.forEach(({ agent, printer }) => {
        const opt = document.createElement('option');
        opt.value = `${agent.deviceId}::${printer}`;
        opt.textContent = `${agent.deviceName} — ${printer}`;
        select.appendChild(opt);
      });
      field.style.display = '';
    })
    .catch(() => {
      const note = document.getElementById('sticker-agent-note');
      if (note) note.textContent = "Couldn't check for print agents - printing will use the browser's print dialog.";
    });

  document.getElementById('sticker-print-btn').addEventListener('click', async () => {
    const widthMm = Number(document.getElementById('sticker-width').value);
    const heightMm = Number(document.getElementById('sticker-height').value);
    if (!(widthMm > 0) || !(heightMm > 0)) {
      showToast('Enter a valid label width and height');
      return;
    }
    const items = [];
    products.forEach((p) => {
      const qty = Math.max(1, Math.round(Number(document.getElementById(`sticker-qty-${p.id}`).value) || 1));
      for (let i = 0; i < qty; i++) items.push(p);
    });
    if (widthMm !== labelSettings.widthMm || heightMm !== labelSettings.heightMm) {
      try {
        labelSettings = await api('/api/label-settings', { method: 'PUT', body: { widthMm, heightMm } });
      } catch (err) {
        showToast(err.message);
        return;
      }
    }
    const printerSelect = document.getElementById('sticker-printer');
    const selected = printerSelect ? printerSelect.value : '';
    closeModal();
    if (selected) {
      // indexOf/slice rather than .split('::') - a printer name could
      // theoretically contain "::" itself, and this stays correct either way.
      const sep = selected.indexOf('::');
      const deviceId = selected.slice(0, sep);
      const printerName = selected.slice(sep + 2);
      printStickersViaAgent(items, widthMm, heightMm, deviceId, printerName);
    } else {
      printStickers(items, widthMm, heightMm);
    }
  });
}

// One label per physical page/pull, sized via a dynamically-injected @page
// rule (see setStickerPageSize) - built for a dedicated label printer, not
// sheet-fed multi-label paper.
function buildStickerPageHtml(product, widthMm, heightMm) {
  const barcodeArea = stickerBarcodeAreaMm(widthMm, heightMm);
  const { svg, note } = stickerBarcode(product, barcodeArea.widthMm, barcodeArea.heightMm);
  return `
    <div class="sticker-page" style="width:${widthMm}mm;height:${heightMm}mm;">
      <div class="sticker-name">${esc(product.name)}</div>
      <div class="sticker-price">${money(product.price)}</div>
      ${
        svg
          ? `<div class="sticker-barcode">${svg}</div><div class="sticker-code">${esc(product.barcode || product.sku)}</div>`
          : `<div class="sticker-code">${esc(note)}</div>`
      }
    </div>
  `;
}

function ensureStickerPrintRoot() {
  let root = document.getElementById('sticker-print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'sticker-print-root';
    document.body.appendChild(root);
  }
  return root;
}

// @page's size can't be set via an inline style attribute, so this is the
// standard way to make it dynamic per print call - one <style> tag, its
// content replaced each time rather than a new tag appended.
function setStickerPageSize(widthMm, heightMm) {
  let style = document.getElementById('sticker-page-size');
  if (!style) {
    style = document.createElement('style');
    style.id = 'sticker-page-size';
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`;
}

// `items` is already flattened - one entry per physical label, so a
// product with qty 3 appears three times.
function printStickers(items, widthMm, heightMm) {
  const root = ensureStickerPrintRoot();
  root.innerHTML = items.map((p) => buildStickerPageHtml(p, widthMm, heightMm)).join('');
  setStickerPageSize(widthMm, heightMm);
  window.print();
}

// ---- Print agents (print-agent/agent.js) - optional. Any shop PC signed
// into the agent can serve a print job from any browser signed into the
// same shop, not just its own - both sides only ever talk to this app's
// own server (GET/POST /api/print-agents*), never to each other directly,
// so this is a plain same-origin api() call like everything else, no
// localhost/CORS considerations. See print-agent/README.md. ----

// Builds one label's draw primitives (mm-positioned rectangles + text) for
// the print agent - it and print-label.ps1 have no barcode or layout logic
// of their own, so this is the only place deciding where things go for
// that path. Reuses code128Rects/stickerBarcode/stickerBarcodeAreaMm so the
// bar geometry can never drift from what barcodeSvg (the on-screen/browser-
// print path) draws.
function buildStickerPrintJob(product, widthMm, heightMm) {
  const barcodeArea = stickerBarcodeAreaMm(widthMm, heightMm);
  const barcodeX = (widthMm - barcodeArea.widthMm) / 2;
  const barcodeY = heightMm * 0.42;
  const { code, svg, note } = stickerBarcode(product, barcodeArea.widthMm, barcodeArea.heightMm);
  const rects = svg
    ? code128Rects(code, barcodeArea.widthMm, barcodeArea.heightMm).map((r) => ({
        xMm: barcodeX + r.xMm,
        yMm: barcodeY,
        wMm: r.wMm,
        hMm: barcodeArea.heightMm,
      }))
    : [];
  return {
    rects,
    texts: [
      { text: product.name, xMm: widthMm / 2, yMm: heightMm * 0.14, sizePt: 8, bold: true, align: 'center' },
      { text: money(product.price), xMm: widthMm / 2, yMm: heightMm * 0.28, sizePt: 10, bold: true, align: 'center' },
      { text: code || note, xMm: widthMm / 2, yMm: heightMm * 0.9, sizePt: 6.5, bold: false, align: 'center' },
    ],
  };
}

// `items` is already flattened - one entry per physical label (see
// printStickers above). Sends everything as one job so the target device
// runs it as a single multi-page print job, not N separate ones. Queuing
// is all this can confirm - the actual printing happens whenever that
// device's next check-in lands (a couple of seconds later at most), so
// this is honestly "sent," not "done."
async function printStickersViaAgent(items, widthMm, heightMm, deviceId, printerName) {
  try {
    await api(`/api/print-agents/${deviceId}/jobs`, {
      method: 'POST',
      body: {
        printerName,
        widthMm,
        heightMm,
        pages: items.map((p) => buildStickerPrintJob(p, widthMm, heightMm)),
      },
    });
    showToast(`Sent ${items.length} label${items.length === 1 ? '' : 's'} to ${printerName}`);
  } catch (err) {
    showToast(`Couldn't send to the print agent: ${err.message}`);
  }
}

function renderProductFormModal(holder, product) {
  const isEdit = !!product;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit product' : 'Add product'}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="product-form">
          <div class="modal-body">
            <div class="field">
              <label for="f-name">Name *</label>
              <input id="f-name" type="text" required value="${esc(product?.name || '')}" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="f-sku">SKU</label>
                <input id="f-sku" type="text" value="${esc(product?.sku || '')}" />
              </div>
              <div class="field">
                <label for="f-barcode">Barcode</label>
                <input id="f-barcode" type="text" value="${esc(product?.barcode || '')}" placeholder="Scan or type…" />
              </div>
            </div>
            <div class="field">
              <label for="f-category">Category</label>
              <input id="f-category" type="text" list="category-options" value="${esc(product?.category || '')}" placeholder="e.g. Bikes, Parts…" />
              <datalist id="category-options">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="f-price">Price (£) *</label>
                <input id="f-price" type="number" min="0" step="0.01" required value="${product?.price ?? ''}" />
              </div>
              <div class="field">
                <label for="f-cost">Cost (£)</label>
                <input id="f-cost" type="number" min="0" step="0.01" value="${product?.cost ?? ''}" />
              </div>
            </div>
            <div class="field-row">
              ${
                !isEdit
                  ? `<div class="field">
                <label for="f-stock">Starting stock</label>
                <input id="f-stock" type="number" min="0" step="1" value="${product?.stockQty ?? 0}" />
              </div>`
                  : ''
              }
              <div class="field">
                <label for="f-threshold">Low stock alert at</label>
                <input id="f-threshold" type="number" min="0" step="1" value="${product?.lowStockThreshold ?? 3}" />
              </div>
            </div>
            <div class="field">
              <label for="f-supplier">Supplier</label>
              <input id="f-supplier" type="text" value="${esc(product?.supplier || '')}" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Add product'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('f-name').value.trim(),
      sku: document.getElementById('f-sku').value.trim(),
      barcode: document.getElementById('f-barcode').value.trim(),
      category: document.getElementById('f-category').value.trim() || 'Uncategorised',
      price: parseFloat(document.getElementById('f-price').value) || 0,
      cost: parseFloat(document.getElementById('f-cost').value) || 0,
      lowStockThreshold: parseInt(document.getElementById('f-threshold').value, 10) || 0,
      supplier: document.getElementById('f-supplier').value.trim(),
    };
    if (!isEdit) {
      body.stockQty = parseInt(document.getElementById('f-stock').value, 10) || 0;
    }
    try {
      if (isEdit) {
        await api(`/api/products/${product.id}`, { method: 'PUT', body });
      } else {
        await api('/api/products', { method: 'POST', body });
      }
      showToast(isEdit ? 'Product updated' : 'Product added');
      closeModal();
      await refreshInventoryView(product?.id);
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderCatalogueImportModal(holder, item) {
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>Import "${esc(item.name)}"</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="catalogue-import-form">
          <div class="modal-body">
            <div class="field-row">
              <div class="field"><label>SKU</label><input type="text" value="${esc(item.supplierSku)}" disabled /></div>
              <div class="field"><label>Barcode</label><input type="text" value="${esc(item.barcode || '')}" disabled /></div>
            </div>
            <div class="field">
              <label for="f-category">Category *</label>
              <input id="f-category" type="text" list="category-options" required placeholder="e.g. Bikes, Parts…" />
              <datalist id="category-options">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
            </div>
            <div class="field-row">
              <div class="field"><label>Supplier cost</label><input type="text" value="${money(item.price)}" disabled /></div>
              <div class="field">
                <label for="f-price">Sell price (£) *</label>
                <input id="f-price" type="number" min="0" step="0.01" required />
              </div>
            </div>
            <div class="field"><label>Starting stock</label><input type="text" value="${item.stockQty}" disabled /></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Import as product</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('catalogue-import-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      category: document.getElementById('f-category').value.trim() || 'Uncategorised',
      price: parseFloat(document.getElementById('f-price').value) || 0,
    };
    try {
      await api(`/api/catalogue-items/${item.id}/import`, { method: 'POST', body });
      showToast('Product imported');
      closeModal();
      await loadCatalogueItems();
      renderCatalogueTable();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderSupplierFormModal(holder, supplier) {
  const editing = !!supplier;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${editing ? `Edit supplier — ${esc(supplier.name)}` : 'Add supplier'}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="supplier-form">
          <div class="modal-body">
            <div class="field">
              <label for="f-name">Name *</label>
              <input id="f-name" type="text" required placeholder="e.g. Madison" value="${editing ? esc(supplier.name) : ''}" />
            </div>
            ${
              editing
                ? ''
                : `<div class="field">
              <label for="f-adapter">Feed type *</label>
              <select id="f-adapter">
                <option value="mock_csv">Mock CSV (sample data)</option>
              </select>
            </div>`
            }
            <div class="field-row">
              <div class="field">
                <label for="f-contact">Contact name</label>
                <input id="f-contact" type="text" placeholder="e.g. Rep name" value="${editing ? esc(supplier.contactName || '') : ''}" />
              </div>
              <div class="field">
                <label for="f-account">Account number</label>
                <input id="f-account" type="text" placeholder="Your trade account #" value="${editing ? esc(supplier.accountNumber || '') : ''}" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="f-email">Email</label>
                <input id="f-email" type="email" placeholder="orders@supplier.com" value="${editing ? esc(supplier.email || '') : ''}" />
              </div>
              <div class="field">
                <label for="f-phone">Phone</label>
                <input id="f-phone" type="text" placeholder="Optional" value="${editing ? esc(supplier.phone || '') : ''}" />
              </div>
            </div>
            <div class="field">
              <label for="f-address">Address</label>
              <textarea id="f-address" rows="2" placeholder="Optional">${editing ? esc(supplier.address || '') : ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add supplier'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('supplier-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('f-name').value.trim(),
      contactName: document.getElementById('f-contact').value.trim(),
      accountNumber: document.getElementById('f-account').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      address: document.getElementById('f-address').value.trim(),
    };
    if (!editing) body.adapterType = document.getElementById('f-adapter').value;
    try {
      if (editing) {
        await api(`/api/suppliers/${supplier.id}`, { method: 'PUT', body });
        showToast('Supplier updated');
      } else {
        await api('/api/suppliers', { method: 'POST', body });
        showToast('Supplier added');
      }
      closeModal();
      await loadSuppliers();
      renderSupplierTable();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderStockAdjustModal(holder, product) {
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>Adjust stock — ${esc(product.name)}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="stock-form">
          <div class="modal-body">
            <p class="muted">Current stock: <strong>${product.stockQty}</strong></p>
            <div class="field-row">
              <div class="field">
                <label for="s-type">Type</label>
                <select id="s-type">
                  <option value="intake">Stock received</option>
                  <option value="adjustment">Manual adjustment</option>
                </select>
              </div>
              <div class="field">
                <label for="s-change">Quantity change *</label>
                <input id="s-change" type="number" step="1" placeholder="e.g. 10 or -2" required />
              </div>
            </div>
            <div class="field">
              <label for="s-note">Note</label>
              <input id="s-note" type="text" placeholder="Optional" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Apply</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('stock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const change = parseInt(document.getElementById('s-change').value, 10);
    const type = document.getElementById('s-type').value;
    const note = document.getElementById('s-note').value.trim();
    if (!change) { showToast('Enter a non-zero whole number'); return; }
    try {
      await api(`/api/products/${product.id}/stock`, { method: 'POST', body: { change, type, note } });
      showToast('Stock updated');
      closeModal();
      await refreshInventoryView(product.id);
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderCustomerFormModal(holder, customer) {
  const isEdit = !!customer;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit customer' : 'Add customer'}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="customer-form">
          <div class="modal-body">
            <div class="field">
              <label for="c-name">Name *</label>
              <input id="c-name" type="text" required value="${esc(customer?.name || '')}" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="c-email">Email</label>
                <input id="c-email" type="email" value="${esc(customer?.email || '')}" />
              </div>
              <div class="field">
                <label for="c-phone">Phone</label>
                <input id="c-phone" type="text" value="${esc(customer?.phone || '')}" />
              </div>
            </div>
            <div class="field">
              <label for="c-notes">Notes</label>
              <input id="c-notes" type="text" value="${esc(customer?.notes || '')}" placeholder="Optional" />
            </div>
            <div class="field">
              <label>Groups</label>
              ${customerGroups.length
                ? `<div class="weekday-picker">
                    ${customerGroups
                      .map(
                        (g) => `
                      <label class="weekday-check">
                        <input type="checkbox" data-group-id="${g.id}" ${customer?.groups?.some((cg) => cg.id === g.id) ? 'checked' : ''} />
                        ${esc(g.name)}
                      </label>
                    `
                      )
                      .join('')}
                  </div>`
                : `<p class="muted" style="margin:0;">No groups set up yet - add some under Edit Shop &gt; Front Desk.</p>`}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Add customer'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('c-name').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      notes: document.getElementById('c-notes').value.trim(),
      groupIds: [...document.querySelectorAll('[data-group-id]:checked')].map((cb) => Number(cb.dataset.groupId)),
    };
    try {
      let saved;
      if (isEdit) {
        saved = await api(`/api/customers/${customer.id}`, { method: 'PUT', body });
      } else {
        saved = await api('/api/customers', { method: 'POST', body });
      }
      showToast(isEdit ? 'Customer updated' : 'Customer added');
      const afterSave = modal && modal.afterSave;
      closeModal();
      if (afterSave) {
        afterSave(saved);
      } else if (document.getElementById('cust-table-body') || document.getElementById('customer-detail-page')) {
        await refreshCustomerView(saved.id);
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderCustomerSalesModal(holder, customer, sales) {
  const rowsHtml = sales.length
    ? sales
        .map(
          (s) => `
      <tr>
        <td>#${s.id}</td>
        <td>${esc(fmtDateTime(s.createdAt))}</td>
        <td><span class="badge ${paymentBadgeClass(s.paymentMethod)}">${esc(s.paymentMethod)}</span></td>
        <td class="num">${money(s.total)}</td>
      </tr>
    `
        )
        .join('')
    : `<tr><td colspan="4"><div class="empty-state">No sales recorded for this customer yet.</div></td></tr>`;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal wide">
        <div class="modal-header">
          <h2>Sales — ${esc(customer.name)}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <table class="data-table">
            <thead><tr><th>#</th><th>Date &amp; time</th><th>Payment</th><th class="num">Total</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="modal-cancel">Close</button>
        </div>
      </div>
    </div>
  `;
  wireModalDismiss();
}

const SMS_MAX_LEN = 1600;

function renderCustomerSmsModal(holder, customer) {
  if (!customer.phone) {
    holder.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal">
          <div class="modal-header">
            <h2>Text ${esc(customer.name)}</h2>
            <button class="modal-close" id="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <p class="muted">This customer has no phone number on file. Add one via Edit before sending a text.</p>
          </div>
          <div class="modal-footer">
            <button class="btn" id="modal-cancel">Close</button>
          </div>
        </div>
      </div>
    `;
    wireModalDismiss();
    return;
  }

  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>Text ${esc(customer.name)}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="sms-form">
          <div class="modal-body">
            <p class="muted">To: ${esc(customer.phone)}</p>
            <div class="field">
              <label for="sms-body">Message</label>
              <textarea id="sms-body" rows="4" maxlength="${SMS_MAX_LEN}" required placeholder="Type a message…"></textarea>
              <div class="muted" id="sms-char-count" style="font-size:12px; margin-top:4px;">0 / ${SMS_MAX_LEN}</div>
            </div>
            <div class="field-error" id="sms-error" style="display:none;"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="sms-send-btn">Send</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();

  const textarea = document.getElementById('sms-body');
  const counter = document.getElementById('sms-char-count');
  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} / ${SMS_MAX_LEN}`;
  });

  document.getElementById('sms-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = textarea.value.trim();
    if (!body) return;
    const errorEl = document.getElementById('sms-error');
    errorEl.style.display = 'none';
    const sendBtn = document.getElementById('sms-send-btn');
    sendBtn.disabled = true;
    try {
      const message = await api(`/api/customers/${customer.id}/texts`, { method: 'POST', body: { body } });
      if (message.status === 'sent') {
        showToast('Text sent');
        closeModal();
      } else {
        errorEl.textContent = message.error || 'Could not send this text';
        errorEl.style.display = '';
        sendBtn.disabled = false;
      }
      if (document.getElementById('message-table-body')) {
        await loadCustomerMessages(customer.id);
        renderMessageTable();
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = '';
      sendBtn.disabled = false;
    }
  });
}

function renderBikeFormModal(holder, bike, customerId) {
  const isEdit = !!bike;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit bike' : 'Add bike'}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="bike-form">
          <div class="modal-body">
            <div class="field-row">
              <div class="field">
                <label for="bk-make">Make</label>
                <input id="bk-make" type="text" value="${esc(bike?.make || '')}" placeholder="e.g. Trek, Specialized…" />
              </div>
              <div class="field">
                <label for="bk-model">Model</label>
                <input id="bk-model" type="text" value="${esc(bike?.model || '')}" placeholder="e.g. FX2, Rockhopper…" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="bk-colour">Colour</label>
                <input id="bk-colour" type="text" value="${esc(bike?.colour || '')}" />
              </div>
              <div class="field">
                <label for="bk-serial">Serial number</label>
                <input id="bk-serial" type="text" value="${esc(bike?.serialNumber || '')}" />
              </div>
            </div>
            <div class="field">
              <label for="bk-notes">Notes</label>
              <textarea id="bk-notes" rows="3" placeholder="Optional">${esc(bike?.notes || '')}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Add bike'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();

  document.getElementById('bike-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      make: document.getElementById('bk-make').value.trim(),
      model: document.getElementById('bk-model').value.trim(),
      colour: document.getElementById('bk-colour').value.trim(),
      serialNumber: document.getElementById('bk-serial').value.trim(),
      notes: document.getElementById('bk-notes').value.trim(),
    };
    if (!body.make && !body.model) {
      showToast('Enter at least a make or model');
      return;
    }
    try {
      if (isEdit) {
        await api(`/api/bikes/${bike.id}`, { method: 'PUT', body });
      } else {
        await api(`/api/customers/${customerId}/bikes`, { method: 'POST', body });
      }
      showToast(isEdit ? 'Bike updated' : 'Bike added');
      closeModal();
      await loadCustomerBikes(customerId);
      renderBikeTable(customerId);
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderBikeServiceModal(holder, bike, jobs) {
  const label = `${bike.make} ${bike.model}`.trim() || 'Bike';
  const rowsHtml = jobs.length
    ? jobs
        .map(
          (j) => `
      <tr>
        <td>${esc(j.jobDate)}</td>
        <td>${j.startTime ? esc(`${j.startTime}–${j.endTime}`) : '<span class="muted">Unscheduled</span>'}</td>
        <td>${esc(j.title)}</td>
        <td>${esc(j.notes || '—')}</td>
      </tr>
    `
        )
        .join('')
    : `<tr><td colspan="4"><div class="empty-state">No workshop jobs recorded for this bike yet.</div></td></tr>`;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal wide">
        <div class="modal-header">
          <h2>Service history — ${esc(label)}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          ${bike.serialNumber ? `<p class="muted" style="margin-top:0;">Serial: ${esc(bike.serialNumber)}</p>` : ''}
          <table class="data-table">
            <thead><tr><th>Date</th><th>Time</th><th>Job</th><th>Notes</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="modal-cancel">Close</button>
        </div>
      </div>
    </div>
  `;
  wireModalDismiss();
}

function renderEmployeeFormModal(holder, employee) {
  const isEdit = !!employee;
  const isMechanic = employee ? employee.isMechanic : false;
  const workingDays = employee ? employee.workingDays : [0, 1, 2, 3, 4, 5, 6];
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit employee' : 'Add employee'}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="employee-form">
          <div class="modal-body">
            <div class="field">
              <label for="emp-name">Name *</label>
              <input id="emp-name" type="text" required value="${esc(employee?.name || '')}" />
            </div>
            <div class="field">
              <label>Roles</label>
              <div class="weekday-picker">
                <label class="weekday-check">
                  <input type="checkbox" id="emp-is-mechanic" ${isMechanic ? 'checked' : ''} />
                  Mechanic
                </label>
                <label class="weekday-check">
                  <input type="checkbox" id="emp-is-cashier" ${employee?.isCashier ? 'checked' : ''} />
                  Cashier
                </label>
              </div>
            </div>
            <div class="field" id="emp-working-days-field" style="${isMechanic ? '' : 'display:none'}">
              <label>Working days</label>
              <div class="weekday-picker">
                ${WEEKDAY_ORDER.map(
                  (d) => `
                  <label class="weekday-check">
                    <input type="checkbox" data-day="${d}" ${workingDays.includes(d) ? 'checked' : ''} />
                    ${WEEKDAY_LABELS[d]}
                  </label>
                `
                ).join('')}
              </div>
              <p class="muted" style="margin:6px 0 0;">Unchecked days are greyed out on their diary and can't have jobs assigned.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Add employee'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();

  document.getElementById('emp-is-mechanic').addEventListener('change', (e) => {
    document.getElementById('emp-working-days-field').style.display = e.target.checked ? '' : 'none';
  });

  document.getElementById('employee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('emp-name').value.trim(),
      isMechanic: document.getElementById('emp-is-mechanic').checked,
      isCashier: document.getElementById('emp-is-cashier').checked,
      workingDays: [...document.querySelectorAll('#emp-working-days-field input:checked')].map((cb) => Number(cb.dataset.day)),
    };
    try {
      if (isEdit) {
        await api(`/api/employees/${employee.id}`, { method: 'PUT', body });
      } else {
        await api('/api/employees', { method: 'POST', body });
      }
      showToast(isEdit ? 'Employee updated' : 'Employee added');
      closeModal();
      await loadEmployees();
      renderEmployeeTable();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderDayJobsModal(holder, dateStr, jobs) {
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const rowsHtml = jobs.length
    ? jobs
        .map(
          (j) => `
      <button class="day-job-row status-${j.status || 'scheduled'}${jobPaidClass(j)}" data-job="${j.id}">
        <span class="djr-time">${j.startTime ? esc(j.startTime) : 'Unscheduled'}</span>
        <span class="djr-title">${esc(j.title)}</span>
        <span class="djr-status-badge">${esc(JOB_STATUS_LABELS[j.status] || JOB_STATUS_LABELS.scheduled)}</span>
        ${j.customerName ? `<span class="djr-detail">${esc(j.customerName)}${j.bikeLabel ? ' · ' + esc(j.bikeLabel) : ''}</span>` : ''}
        ${j.mechanicName ? `<span class="djr-detail">${esc(j.mechanicName)}</span>` : ''}
      </button>
    `
        )
        .join('')
    : `<div class="empty-state">No jobs on this day.</div>`;

  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${esc(label)}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="day-job-list">${rowsHtml}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="modal-cancel">Close</button>
        </div>
      </div>
    </div>
  `;
  wireModalDismiss();

  holder.querySelectorAll('.day-job-row').forEach((b) => {
    b.addEventListener('click', () => {
      const job = workshopJobs.find((x) => x.id === Number(b.dataset.job));
      closeModal();
      openModal({ type: 'workshop-job-form', job });
    });
  });
  wireJobContextMenuOn(holder, '.day-job-row');
  wireJobTooltipOn(holder, '.day-job-row');
}

function renderWorkshopJobFormModal(holder, job, defaultDate, prefill, defaultTime, prefillMechanicId, skipAutoOrder) {
  const isEdit = !!job;
  const initial = job || prefill || {};
  let wjCustomerId = initial.customerId || null;
  const defaultMechanicId =
    initial.mechanicId ||
    prefillMechanicId ||
    (Array.isArray(workshopMechanicFilter) && workshopMechanicFilter.length === 1 ? workshopMechanicFilter[0] : null);
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal job-modal">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit job' : 'Add workshop job'}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <form id="workshop-job-form">
          <div class="modal-body">
          <div class="wj-body-grid">
          <div class="wj-form-fields">
            <div class="field">
              <label for="wj-title">Job title *</label>
              <input id="wj-title" type="text" required value="${esc(initial.title || '')}" placeholder="e.g. Puncture repair, Full service…" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="wj-date">Date *</label>
                <input id="wj-date" type="date" required value="${esc(job?.jobDate || defaultDate || '')}" />
              </div>
              <div class="field">
                <label for="wj-time">Start time</label>
                <input id="wj-time" type="time" value="${esc(job?.startTime || defaultTime || '')}" />
              </div>
              <div class="field">
                <label for="wj-end-time">End time</label>
                <input id="wj-end-time" type="time" value="${esc(job?.endTime || '')}" />
              </div>
            </div>
            <div class="field">
              <label for="wj-customer-input">Customer</label>
              <div class="search-wrap">
                <input type="text" id="wj-customer-input" class="search-input" placeholder="No customer linked" autocomplete="off" value="${esc(customers.find((c) => c.id === initial.customerId)?.name || '')}" />
                <div class="search-dropdown" id="wj-customer-dropdown"></div>
              </div>
              <div id="wj-new-customer-form" class="inline-subform" style="display:none;">
                <div class="field">
                  <label for="wj-nc-name">Name *</label>
                  <input id="wj-nc-name" type="text" />
                </div>
                <div class="field-row">
                  <div class="field">
                    <label for="wj-nc-email">Email</label>
                    <input id="wj-nc-email" type="email" />
                  </div>
                  <div class="field">
                    <label for="wj-nc-phone">Phone</label>
                    <input id="wj-nc-phone" type="text" />
                  </div>
                </div>
                <div class="inline-subform-actions">
                  <button type="button" class="btn btn-sm" id="wj-nc-cancel">Cancel</button>
                  <button type="button" class="btn btn-sm btn-primary" id="wj-nc-save">Add customer</button>
                </div>
              </div>
            </div>
            <div class="field" id="wj-bike-field" style="display:none;">
              <label for="wj-bike">Bike</label>
              <select id="wj-bike">
                <option value="">No bike linked</option>
              </select>
              <div id="wj-new-bike-form" class="inline-subform" style="display:none;">
                <div class="field-row">
                  <div class="field">
                    <label for="wj-nb-make">Make</label>
                    <input id="wj-nb-make" type="text" placeholder="e.g. Trek" />
                  </div>
                  <div class="field">
                    <label for="wj-nb-model">Model</label>
                    <input id="wj-nb-model" type="text" placeholder="e.g. FX2" />
                  </div>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label for="wj-nb-colour">Colour</label>
                    <input id="wj-nb-colour" type="text" />
                  </div>
                  <div class="field">
                    <label for="wj-nb-serial">Serial number</label>
                    <input id="wj-nb-serial" type="text" />
                  </div>
                </div>
                <div class="inline-subform-actions">
                  <button type="button" class="btn btn-sm" id="wj-nb-cancel">Cancel</button>
                  <button type="button" class="btn btn-sm btn-primary" id="wj-nb-save">Add bike</button>
                </div>
              </div>
            </div>
            <div class="field">
              <label for="wj-mechanic">Mechanic</label>
              <select id="wj-mechanic">
                <option value="">Unassigned</option>
                ${mechanics.map((m) => `<option value="${m.id}" ${defaultMechanicId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="wj-status">Status</label>
              <select id="wj-status">
                ${JOB_STATUS_SELECT_OPTIONS.map((s) => `<option value="${s.value}" ${(initial.status && initial.status !== 'complete' ? initial.status : 'scheduled') === s.value ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="wj-notes-col">
            <div class="field wj-items-field" id="wj-items-section">
              <label>Items</label>
              ${
                isEdit
                  ? `
                <div class="search-wrap">
                  <input type="text" id="wj-item-search" class="search-input" placeholder="Search products, SKU or scan barcode…" autocomplete="off" />
                  <div class="search-dropdown" id="wj-item-dropdown"></div>
                </div>
                <div class="cart-items" id="wj-items-list"><div class="empty-cart">Loading…</div></div>
                <div class="wj-items-total muted" id="wj-items-total"></div>
              `
                  : `<p class="muted" style="margin:0;">Save the job first, then reopen it here to add items.</p>`
              }
            </div>
            <div class="field wj-attachments-field" id="wj-attachments-section">
              <label>Attachments</label>
              ${
                isEdit
                  ? `
                <div class="attachment-list" id="wj-attachments-list"><div class="empty-cart">Loading…</div></div>
                <input type="file" id="wj-attachment-file" style="display:none;" />
                <button type="button" class="btn btn-sm" id="wj-attachment-add">+ Attach file</button>
              `
                  : `<p class="muted" style="margin:0;">Save the job first, then reopen it here to attach files.</p>`
              }
            </div>
            <div class="field wj-notes-field">
              <label for="wj-notes">Notes</label>
              <textarea id="wj-notes" placeholder="Optional">${esc(initial.notes || '')}</textarea>
            </div>
          </div>
          </div>
          </div>
          <div class="modal-footer">
            ${isEdit ? `<button type="button" class="btn btn-danger" id="wj-delete" style="margin-right:auto;">Delete</button>` : ''}
            ${isEdit ? `<button type="button" class="btn ${initial.status === 'complete' ? 'btn-accent' : ''}" id="wj-complete-toggle">${initial.status === 'complete' ? 'Reopen job' : 'Mark complete'}</button>` : ''}
            <button type="button" class="btn" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Add job'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  wireModalDismiss();

  let wjBikeId = initial.bikeId || null;
  let wjOrderId = job?.orderId || null;
  let wjItems = [];
  let wjItemsDiscount = 0;
  let wjOrderStatus = 'open';
  let wjItemSearch = '';

  function hideNewBikeForm() {
    const form = document.getElementById('wj-new-bike-form');
    if (!form) return;
    form.style.display = 'none';
    document.getElementById('wj-nb-make').value = '';
    document.getElementById('wj-nb-model').value = '';
    document.getElementById('wj-nb-colour').value = '';
    document.getElementById('wj-nb-serial').value = '';
  }

  function showNewBikeForm() {
    document.getElementById('wj-new-bike-form').style.display = '';
    document.getElementById('wj-nb-make').focus();
  }

  async function refreshBikeOptions(customerId, preserveId) {
    const bikeField = document.getElementById('wj-bike-field');
    const bikeSelect = document.getElementById('wj-bike');
    hideNewBikeForm();
    if (!customerId) {
      wjBikeId = null;
      if (bikeField) bikeField.style.display = 'none';
      if (bikeSelect) bikeSelect.innerHTML = '<option value="">No bike linked</option>';
      return;
    }
    const bikes = await api(`/api/customers/${customerId}/bikes`);
    if (bikeField) bikeField.style.display = '';
    if (bikeSelect) {
      bikeSelect.innerHTML =
        '<option value="">No bike linked</option>' +
        bikes
          .map((b) => `<option value="${b.id}" ${preserveId === b.id ? 'selected' : ''}>${esc(`${b.make} ${b.model}`.trim() || 'Bike')}</option>`)
          .join('') +
        '<option value="__new__">+ New bike…</option>';
    }
    wjBikeId = bikes.some((b) => b.id === preserveId) ? preserveId : null;
  }

  function hideNewCustomerForm() {
    const form = document.getElementById('wj-new-customer-form');
    if (!form) return;
    form.style.display = 'none';
    document.getElementById('wj-nc-name').value = '';
    document.getElementById('wj-nc-email').value = '';
    document.getElementById('wj-nc-phone').value = '';
  }

  function showNewCustomerForm() {
    document.getElementById('wj-new-customer-form').style.display = '';
    document.getElementById('wj-nc-name').focus();
  }

  setupCustomerAutocomplete({
    inputId: 'wj-customer-input',
    dropdownId: 'wj-customer-dropdown',
    getSelectedId: () => wjCustomerId,
    setSelectedId: (id) => { wjCustomerId = id; },
    emptyLabel: 'No customer linked',
    allowCreate: true,
    onChange: () => {
      hideNewCustomerForm();
      refreshBikeOptions(wjCustomerId, null);
    },
    onCreateNew: showNewCustomerForm,
  });

  document.getElementById('wj-nc-cancel').addEventListener('click', () => {
    document.getElementById('wj-customer-input').value = customers.find((c) => c.id === wjCustomerId)?.name || '';
    hideNewCustomerForm();
  });

  document.getElementById('wj-nc-save').addEventListener('click', async () => {
    const name = document.getElementById('wj-nc-name').value.trim();
    if (!name) {
      showToast('Enter a customer name');
      return;
    }
    const body = {
      name,
      email: document.getElementById('wj-nc-email').value.trim(),
      phone: document.getElementById('wj-nc-phone').value.trim(),
    };
    try {
      const customer = await api('/api/customers', { method: 'POST', body });
      showToast('Customer added');
      await loadActiveCustomers();
      wjCustomerId = customer.id;
      document.getElementById('wj-customer-input').value = customer.name;
      hideNewCustomerForm();
      await refreshBikeOptions(wjCustomerId, null);
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('wj-bike').addEventListener('change', (e) => {
    if (e.target.value === '__new__') {
      showNewBikeForm();
      return;
    }
    wjBikeId = e.target.value ? Number(e.target.value) : null;
  });

  document.getElementById('wj-nb-cancel').addEventListener('click', () => {
    document.getElementById('wj-bike').value = wjBikeId || '';
    hideNewBikeForm();
  });

  document.getElementById('wj-nb-save').addEventListener('click', async () => {
    const make = document.getElementById('wj-nb-make').value.trim();
    const model = document.getElementById('wj-nb-model').value.trim();
    if (!make && !model) {
      showToast('Enter at least a make or model');
      return;
    }
    const body = {
      make,
      model,
      colour: document.getElementById('wj-nb-colour').value.trim(),
      serialNumber: document.getElementById('wj-nb-serial').value.trim(),
    };
    try {
      const bike = await api(`/api/customers/${wjCustomerId}/bikes`, { method: 'POST', body });
      showToast('Bike added');
      await refreshBikeOptions(wjCustomerId, bike.id);
      document.getElementById('wj-bike').value = String(bike.id);
      wjBikeId = bike.id;
    } catch (err) {
      showToast(err.message);
    }
  });

  refreshBikeOptions(wjCustomerId, initial.bikeId || null);

  let jobIsComplete = initial.status === 'complete';
  let preCompleteStatus = 'scheduled';

  function applyLockState() {
    const form = document.getElementById('workshop-job-form');
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      el.disabled = jobIsComplete;
    });
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = jobIsComplete;
    const grid = document.querySelector('.wj-body-grid');
    if (grid) grid.classList.toggle('wj-locked', jobIsComplete);
    if (jobIsComplete) {
      hideNewCustomerForm();
      hideNewBikeForm();
    }
    const toggleBtn = document.getElementById('wj-complete-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = jobIsComplete ? 'Reopen job' : 'Mark complete';
      toggleBtn.classList.toggle('btn-accent', jobIsComplete);
    }
    renderWjItemsList();
  }

  function wjItemsEditable() {
    return isEdit && !!wjOrderId && wjOrderStatus === 'open' && !jobIsComplete;
  }

  function renderWjItemsList() {
    const container = document.getElementById('wj-items-list');
    const totalEl = document.getElementById('wj-items-total');
    if (!container) return;
    const editable = wjItemsEditable();
    if (!wjItems.length) {
      container.innerHTML = '<div class="empty-cart">No items yet.</div>';
    } else {
      container.innerHTML = wjItems
        .map((l, idx) => {
          const pct = pctOff(l.originalPrice ?? l.price, l.price);
          return `
          <div class="cart-line" data-idx="${idx}">
            <div class="info">
              <div class="name">${esc(l.name)}</div>
              <div class="unit">
                £<input type="number" class="price-input" data-wj-price-idx="${idx}" min="0" step="0.01" value="${l.price}" ${editable ? '' : 'disabled'} /> each
                <span class="line-discount-badge" data-wj-badge-idx="${idx}" ${pct > 0 ? '' : 'style="display:none"'}>${pct > 0 ? `−${pct}% off` : ''}</span>
              </div>
            </div>
            ${
              editable
                ? `<div class="qty-control">
              <button type="button" data-wj-dec="${idx}">−</button>
              <span>${l.qty}</span>
              <button type="button" data-wj-inc="${idx}">+</button>
            </div>`
                : `<div class="qty-control"><span>${l.qty}</span></div>`
            }
            <div class="line-total">${money(l.price * l.qty)}</div>
            ${editable ? `<button type="button" class="remove-btn" data-wj-remove="${idx}" title="Remove">✕</button>` : ''}
          </div>
        `;
        })
        .join('');
    }

    const total = wjItems.reduce((sum, l) => sum + l.price * l.qty, 0);
    if (totalEl) totalEl.textContent = wjItems.length ? `Total: ${money(Math.max(0, total - wjItemsDiscount))}` : '';
    if (!editable) return;

    container.querySelectorAll('input[data-wj-price-idx]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.wjPriceIdx);
        wjItems[idx].price = Math.max(0, parseFloat(e.target.value) || 0);
        saveWjItems();
      });
    });
    container.querySelectorAll('button[data-wj-inc]').forEach((b) =>
      b.addEventListener('click', () => {
        wjItems[Number(b.dataset.wjInc)].qty += 1;
        saveWjItems();
      })
    );
    container.querySelectorAll('button[data-wj-dec]').forEach((b) =>
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.wjDec);
        if (wjItems[idx].qty <= 1) wjItems.splice(idx, 1);
        else wjItems[idx].qty -= 1;
        saveWjItems();
      })
    );
    container.querySelectorAll('button[data-wj-remove]').forEach((b) =>
      b.addEventListener('click', () => {
        wjItems.splice(Number(b.dataset.wjRemove), 1);
        saveWjItems();
      })
    );
  }

  async function saveWjItems() {
    if (!wjOrderId) return;
    renderWjItemsList();
    try {
      const updated = await api(`/api/sale-documents/${wjOrderId}/items`, {
        method: 'PUT',
        body: {
          items: wjItems.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.price })),
          discount: wjItemsDiscount,
        },
      });
      wjOrderStatus = updated.status;
      await refreshDocListAfterChange('order');
    } catch (err) {
      showToast(err.message);
    }
  }

  function getWjItemMatches() {
    const term = wjItemSearch.trim().toLowerCase();
    if (!term) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.barcode || '').toLowerCase().includes(term)
    );
  }

  function renderWjItemDropdown() {
    const dropdown = document.getElementById('wj-item-dropdown');
    if (!dropdown) return;
    if (!wjItemSearch.trim()) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      return;
    }
    const matches = getWjItemMatches().slice(0, 8);
    dropdown.classList.add('open');
    if (!matches.length) {
      dropdown.innerHTML = '<div class="search-dropdown-empty">No products match.</div>';
      return;
    }
    dropdown.innerHTML = matches
      .map(
        (p) => `
        <button type="button" class="search-dropdown-item" data-wj-add="${p.id}">
          <span class="sdi-main">
            <span class="sdi-name">${esc(p.name)}</span>
            <span class="sdi-sku">${esc(p.sku || '')}</span>
          </span>
          <span class="sdi-side"><span class="sdi-price">${money(p.price)}</span></span>
        </button>
      `
      )
      .join('');
    dropdown.querySelectorAll('button[data-wj-add]').forEach((btn) => {
      btn.addEventListener('click', () => addWjItem(Number(btn.dataset.wjAdd)));
    });
  }

  function addWjItem(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const existing = wjItems.find((l) => l.productId === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      wjItems.push({ productId: p.id, name: p.name, sku: p.sku, price: p.price, originalPrice: p.price, qty: 1 });
    }
    const searchInput = document.getElementById('wj-item-search');
    if (searchInput) searchInput.value = '';
    wjItemSearch = '';
    renderWjItemDropdown();
    saveWjItems();
  }

  async function loadWjItems() {
    if (!isEdit || !wjOrderId) return;
    await loadProducts();
    try {
      const order = await api(`/api/sale-documents/${wjOrderId}`);
      wjOrderStatus = order.status;
      wjItemsDiscount = order.discount || 0;
      wjItems = (order.items || []).map((it) => {
        const product = products.find((p) => p.id === it.productId);
        return {
          productId: it.productId,
          name: it.name,
          sku: it.sku,
          price: it.unitPrice,
          originalPrice: product ? product.price : it.unitPrice,
          qty: it.qty,
        };
      });
    } catch (err) {
      showToast(err.message);
    }
    renderWjItemsList();
  }

  function fmtFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function loadWjAttachments() {
    if (!isEdit) return;
    const list = document.getElementById('wj-attachments-list');
    try {
      const rows = await api(`/api/workshop-jobs/${job.id}/attachments`);
      renderWjAttachments(rows);
    } catch (err) {
      if (list) list.innerHTML = `<div class="empty-cart">Could not load attachments.</div>`;
    }
  }

  function renderWjAttachments(rows) {
    const list = document.getElementById('wj-attachments-list');
    if (!list) return;
    list.innerHTML = rows.length
      ? rows
          .map(
            (a) => `
        <div class="attachment-row">
          <a href="/api/workshop-jobs/${job.id}/attachments/${a.id}" target="_blank" rel="noopener">${esc(a.originalName)}</a>
          <span class="muted">${fmtFileSize(a.sizeBytes)}</span>
          <button type="button" class="btn btn-sm btn-danger" data-remove-attachment="${a.id}">Remove</button>
        </div>
      `
          )
          .join('')
      : `<div class="empty-cart">No files attached.</div>`;
    list.querySelectorAll('[data-remove-attachment]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this attachment?')) return;
        try {
          await api(`/api/workshop-jobs/${job.id}/attachments/${btn.dataset.removeAttachment}`, { method: 'DELETE' });
          loadWjAttachments();
        } catch (err) {
          showToast(err.message);
        }
      });
    });
  }

  const wjAttachmentAddBtn = document.getElementById('wj-attachment-add');
  const wjAttachmentFileInput = document.getElementById('wj-attachment-file');
  if (wjAttachmentAddBtn && wjAttachmentFileInput) {
    wjAttachmentAddBtn.addEventListener('click', () => wjAttachmentFileInput.click());
    wjAttachmentFileInput.addEventListener('change', async () => {
      const file = wjAttachmentFileInput.files[0];
      wjAttachmentFileInput.value = '';
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) {
        showToast('That file is too large (max 15MB).');
        return;
      }
      wjAttachmentAddBtn.disabled = true;
      wjAttachmentAddBtn.textContent = 'Uploading…';
      try {
        const dataBase64 = await fileToBase64(file);
        await api(`/api/workshop-jobs/${job.id}/attachments`, {
          method: 'POST',
          body: { filename: file.name, contentType: file.type, dataBase64 },
        });
        await loadWjAttachments();
      } catch (err) {
        showToast(err.message);
      } finally {
        wjAttachmentAddBtn.disabled = false;
        wjAttachmentAddBtn.textContent = '+ Attach file';
      }
    });
  }

  const wjItemSearchInput = document.getElementById('wj-item-search');
  if (wjItemSearchInput) {
    wjItemSearchInput.addEventListener('input', (e) => {
      wjItemSearch = e.target.value;
      renderWjItemDropdown();
    });
    wjItemSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const matches = getWjItemMatches();
        if (matches.length > 0) addWjItem(matches[0].id);
      }
    });
  }

  loadWjItems();
  loadWjAttachments();
  applyLockState();

  const completeToggleBtn = document.getElementById('wj-complete-toggle');
  if (completeToggleBtn) {
    completeToggleBtn.addEventListener('click', async () => {
      try {
        let body;
        if (!jobIsComplete) {
          preCompleteStatus = document.getElementById('wj-status').value || 'scheduled';
          body = { status: 'complete' };
        } else {
          body = { status: preCompleteStatus };
        }
        const saved = await api(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body });
        jobIsComplete = saved.status === 'complete';
        if (!jobIsComplete) {
          document.getElementById('wj-status').value = saved.status;
        }
        applyLockState();
        showToast(jobIsComplete ? 'Job marked complete' : 'Job reopened');
        if (document.getElementById('week-diaries')) await renderWorkshop();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  document.getElementById('workshop-job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      title: document.getElementById('wj-title').value.trim(),
      jobDate: document.getElementById('wj-date').value,
      startTime: document.getElementById('wj-time').value,
      endTime: document.getElementById('wj-end-time').value,
      customerId: wjCustomerId,
      bikeId: wjBikeId,
      mechanicId: document.getElementById('wj-mechanic').value || null,
      status: document.getElementById('wj-status').value,
      notes: document.getElementById('wj-notes').value.trim(),
    };
    if (!isEdit && skipAutoOrder) body.skipAutoOrder = true;
    try {
      let saved;
      if (isEdit) {
        saved = await api(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body });
      } else {
        saved = await api('/api/workshop-jobs', { method: 'POST', body });
      }
      showToast(isEdit ? 'Job updated' : 'Job added');
      const afterSave = modal && modal.afterSave;
      closeModal();
      if (afterSave) {
        afterSave(saved);
      } else if (document.getElementById('week-diaries')) {
        await renderWorkshop();
      }
    } catch (err) {
      showToast(err.message);
    }
  });

  const deleteBtn = document.getElementById('wj-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${job.title}"?`)) return;
      try {
        await api(`/api/workshop-jobs/${job.id}`, { method: 'DELETE' });
        showToast('Job deleted');
        closeModal();
        await renderWorkshop();
      } catch (err) {
        showToast(err.message);
      }
    });
  }
}

async function refreshDocListAfterChange(kind) {
  if (document.getElementById('order-table-body')) {
    await loadSaleDocuments(kind);
    renderFrontDeskOrderTable();
  }
}

function renderDocumentModal(holder, doc) {
  const kindLabel = doc.kind === 'quote' ? 'Quote' : 'Order';
  const itemsHtml = (doc.items || [])
    .map(
      (it) => `
      <div class="rline"><span>${it.qty} × ${esc(it.name)}</span><span>${money(it.lineTotal)}</span></div>
    `
    )
    .join('');
  const isOpen = doc.status === 'open';
  const isOrder = doc.kind === 'order';
  const editable = isOpen && isOrder;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${kindLabel} #${doc.id}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="receipt">
            <div class="receipt-header">
              <div class="shop-name">Wheelhouse Cycles</div>
              <div class="muted">${kindLabel} #${doc.id} · ${esc(fmtDateTime(doc.createdAt))}</div>
              ${!editable && doc.title ? `<div class="muted">${esc(doc.title)}</div>` : ''}
              ${!editable && doc.customerName ? `<div class="muted">Customer: ${esc(doc.customerName)}</div>` : ''}
              <div style="margin-top:6px;"><span class="badge ${docStatusBadgeClass(doc.status)}">${esc(doc.status)}</span></div>
            </div>
            <hr />
            ${itemsHtml}
            <hr />
            <div class="rline"><span>Subtotal</span><span>${money(doc.subtotal)}</span></div>
            <div class="rline"><span>Discount</span><span>−${money(doc.discount)}</span></div>
            <div class="rline rtotal"><span>Total</span><span>${money(doc.total)}</span></div>
            <div class="rline"><span>Inc. VAT (20%)</span><span>${money(vatFromInclusive(doc.total))}</span></div>
          </div>
          ${!editable && doc.note ? `<p class="muted" style="margin-top:14px;">${esc(doc.note)}</p>` : ''}
          ${doc.status === 'converted' ? `<p class="muted" style="margin-top:14px;">Converted to Sale #${doc.convertedSaleId}.</p>` : ''}
          ${
            editable
              ? `
            <div class="field" style="margin-top:16px;">
              <label for="doc-title">Title</label>
              <input id="doc-title" type="text" value="${esc(doc.title || '')}" placeholder="e.g. Jane's puncture repair order" />
            </div>
            <div class="field">
              <label for="doc-customer-input">Customer</label>
              <div class="search-wrap">
                <input type="text" id="doc-customer-input" class="search-input" placeholder="Walk-in / no account" autocomplete="off" value="${esc(doc.customerName || '')}" />
                <div class="search-dropdown" id="doc-customer-dropdown"></div>
              </div>
            </div>
            <div class="field">
              <label for="doc-notes">Notes</label>
              <textarea id="doc-notes" rows="3" placeholder="Optional">${esc(doc.note || '')}</textarea>
            </div>
            <div class="field">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
                <input type="checkbox" id="doc-workshop-toggle" style="width:auto;" ${doc.workshopJobId ? 'checked' : ''} />
                Show in workshop diary
              </label>
              <div class="muted" style="font-size:12px; margin-top:2px;">
                ${doc.workshopJobId ? 'This order has a linked workshop job.' : 'Not currently scheduled in the workshop.'}
              </div>
              ${doc.workshopJobId ? `<button type="button" class="btn btn-sm" id="doc-view-job-btn" style="margin-top:8px;">View / edit workshop job</button>` : ''}
            </div>
          `
              : ''
          }
          ${
            isOpen
              ? `
            <div class="field-row" style="margin-top:16px;">
              <div class="field">
                <label for="doc-payment-method">Payment method</label>
                <select id="doc-payment-method">
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              <div class="field" id="doc-cash-field">
                <label for="doc-cash-tendered">Cash tendered (£)</label>
                <input id="doc-cash-tendered" type="number" min="0" step="0.01" placeholder="${doc.total.toFixed(2)}" />
              </div>
            </div>
            ${!activeCashierId ? `<p class="muted" style="margin:8px 0 0; font-size:12px;">Select a cashier on Front Desk before converting to a sale.</p>` : ''}
          `
              : ''
          }
        </div>
        <div class="modal-footer">
          ${isOpen ? `<button type="button" class="btn btn-danger" id="doc-cancel-btn" style="margin-right:auto;">${doc.kind === 'quote' ? 'Decline quote' : 'Cancel order'}</button>` : ''}
          <button class="btn" id="modal-cancel">Close</button>
          ${editable ? `<button type="button" class="btn" id="doc-save-details-btn">Save details</button>` : ''}
          ${isOpen ? `<button class="btn btn-primary" id="doc-convert-btn" ${activeCashierId ? '' : 'disabled'}>Convert to sale</button>` : ''}
        </div>
      </div>
    </div>
  `;
  wireModalDismiss();

  const paymentSelect = document.getElementById('doc-payment-method');
  if (paymentSelect) {
    paymentSelect.addEventListener('change', () => {
      document.getElementById('doc-cash-field').style.display = paymentSelect.value === 'Cash' ? '' : 'none';
    });
  }

  const cancelDocBtn = document.getElementById('doc-cancel-btn');
  if (cancelDocBtn) {
    cancelDocBtn.addEventListener('click', async () => {
      const verb = doc.kind === 'quote' ? 'Decline' : 'Cancel';
      if (!confirm(`${verb} ${doc.kind} #${doc.id}?`)) return;
      try {
        await api(`/api/sale-documents/${doc.id}`, { method: 'PUT', body: { status: 'cancelled' } });
        showToast(doc.kind === 'quote' ? 'Quote declined' : 'Order cancelled');
        closeModal();
        await refreshDocListAfterChange(doc.kind);
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  const convertBtn = document.getElementById('doc-convert-btn');
  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      if (!activeCashierId) {
        showToast('Select a cashier before completing the sale');
        return;
      }
      const method = document.getElementById('doc-payment-method').value;
      const docCashTendered =
        method === 'Cash' ? parseFloat(document.getElementById('doc-cash-tendered').value) || doc.total : null;
      const docCashAmount = method === 'Cash' ? doc.total : 0;
      const docCardAmount = method === 'Card' ? doc.total : 0;
      convertBtn.disabled = true;
      convertBtn.textContent = 'Processing…';
      try {
        const sale = await api(`/api/sale-documents/${doc.id}/convert`, {
          method: 'POST',
          body: { cashAmount: docCashAmount, cardAmount: docCardAmount, cashTendered: docCashTendered, cashierId: activeCashierId },
        });
        showToast(`${kindLabel} converted to sale`);
        closeModal();
        openModal({ type: 'receipt', sale, title: `Sale #${sale.id}` });
      } catch (err) {
        showToast(err.message);
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert to sale';
      }
    });
  }

  if (editable) {
    let docCustomerId = doc.customerId || null;

    setupCustomerAutocomplete({
      inputId: 'doc-customer-input',
      dropdownId: 'doc-customer-dropdown',
      getSelectedId: () => docCustomerId,
      setSelectedId: (id) => { docCustomerId = id; },
    });

    const saveDetailsBtn = document.getElementById('doc-save-details-btn');
    saveDetailsBtn.addEventListener('click', async () => {
      const body = {
        title: document.getElementById('doc-title').value.trim(),
        customerId: docCustomerId,
        note: document.getElementById('doc-notes').value.trim(),
      };
      saveDetailsBtn.disabled = true;
      try {
        const updated = await api(`/api/sale-documents/${doc.id}`, { method: 'PUT', body });
        showToast('Order details saved');
        await refreshDocListAfterChange(doc.kind);
        renderDocumentModal(holder, updated);
      } catch (err) {
        showToast(err.message);
        saveDetailsBtn.disabled = false;
      }
    });

    const workshopToggle = document.getElementById('doc-workshop-toggle');
    workshopToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const capturedTitle = document.getElementById('doc-title').value.trim() || `Order #${doc.id}`;
        const capturedNotes = document.getElementById('doc-notes').value.trim();
        const capturedCustomerId = docCustomerId;
        openModal({
          type: 'workshop-job-form',
          job: null,
          defaultDate: toDateStr(new Date()),
          prefill: {
            title: capturedTitle,
            customerId: capturedCustomerId,
            notes: capturedNotes,
          },
          skipAutoOrder: true,
          afterSave: async (savedJob) => {
            try {
              await api(`/api/sale-documents/${doc.id}`, {
                method: 'PUT',
                body: { workshopJobId: savedJob.id, title: capturedTitle, customerId: capturedCustomerId, note: capturedNotes },
              });
              showToast('Order linked to workshop job');
            } catch (err) {
              showToast(err.message);
            }
            await refreshDocListAfterChange(doc.kind);
          },
        });
      } else {
        if (!confirm('Remove this order from the workshop diary? The linked workshop job will be deleted.')) {
          e.target.checked = true;
          return;
        }
        try {
          await api(`/api/workshop-jobs/${doc.workshopJobId}`, { method: 'DELETE' });
          showToast('Removed from workshop diary');
          const updated = await api(`/api/sale-documents/${doc.id}`);
          await refreshDocListAfterChange(doc.kind);
          renderDocumentModal(holder, updated);
        } catch (err) {
          showToast(err.message);
          e.target.checked = true;
        }
      }
    });

    const viewJobBtn = document.getElementById('doc-view-job-btn');
    if (viewJobBtn) {
      viewJobBtn.addEventListener('click', async () => {
        try {
          const job = await api(`/api/workshop-jobs/${doc.workshopJobId}`);
          openModal({ type: 'workshop-job-form', job });
        } catch (err) {
          showToast(err.message);
        }
      });
    }
  }
}

function renderReceiptModal(holder, sale, title) {
  const itemsHtml = (sale.items || [])
    .map(
      (it) => `
      <div class="rline"><span>${it.qty} × ${esc(it.name)}</span><span>${money(it.lineTotal)}</span></div>
    `
    )
    .join('');
  const changeDue = sale.cashAmount > 0 && sale.cashTendered != null ? sale.cashTendered - sale.cashAmount : null;
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>${esc(title || 'Receipt')}</h2>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="receipt">
            <div class="receipt-header">
              <div class="shop-name">Wheelhouse Cycles</div>
              <div class="muted">Sale #${sale.id} · ${esc(fmtDateTime(sale.createdAt))}</div>
              ${sale.customerName ? `<div class="muted">Customer: ${esc(sale.customerName)}</div>` : ''}
              ${sale.cashierName ? `<div class="muted">Cashier: ${esc(sale.cashierName)}</div>` : ''}
            </div>
            <hr />
            ${itemsHtml}
            <hr />
            <div class="rline"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
            <div class="rline"><span>Discount</span><span>−${money(sale.discount)}</span></div>
            ${sale.groupDiscountAmount ? `<div class="rline"><span>${esc(sale.groupDiscountName)} discount</span><span>−${money(sale.groupDiscountAmount)}</span></div>` : ''}
            <div class="rline rtotal"><span>Total</span><span>${money(sale.total)}</span></div>
            <div class="rline"><span>Inc. VAT (20%)</span><span>${money(vatFromInclusive(sale.total))}</span></div>
            <div class="rline"><span>Payment</span><span>${esc(sale.paymentMethod)}</span></div>
            ${
              sale.paymentMethod === 'Split'
                ? `${sale.cashAmount > 0 ? `<div class="rline"><span>Cash</span><span>${money(sale.cashAmount)}</span></div>` : ''}
                   ${sale.cardAmount > 0 ? `<div class="rline"><span>Card</span><span>${money(sale.cardAmount)}</span></div>` : ''}
                   ${(sale.extraPayments || [])
                     .map((p) => `<div class="rline"><span>${esc(p.tenderType)}</span><span>${money(p.amount)}</span></div>`)
                     .join('')}`
                : ''
            }
            ${
              changeDue !== null
                ? `<div class="rline"><span>Tendered</span><span>${money(sale.cashTendered)}</span></div>
                   <div class="rline"><span>Change</span><span>${money(changeDue)}</span></div>`
                : ''
            }
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="modal-print">Print</button>
          <button class="btn btn-primary" id="modal-cancel">Done</button>
        </div>
      </div>
    </div>
  `;
  wireModalDismiss();
  document.getElementById('modal-print').addEventListener('click', () => window.print());
}

function wireModalDismiss() {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const cancelBtn = document.getElementById('modal-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
}

// ---------------- Auth screen ----------------

let authMode = 'login'; // 'login' | 'signup'
let authError = '';

function renderAuthScreen() {
  const app = document.getElementById('app');
  const isSignup = authMode === 'signup';
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand"><span class="logo">🚲</span> Wheelhouse EPOS</div>
        <div class="auth-tabs">
          <button class="auth-tab ${!isSignup ? 'active' : ''}" data-auth-tab="login">Log in</button>
          <button class="auth-tab ${isSignup ? 'active' : ''}" data-auth-tab="signup">Create shop account</button>
        </div>
        ${authError ? `<div class="error-banner">${esc(authError)}</div>` : ''}
        <form id="auth-form">
          ${isSignup ? `
            <div class="field">
              <label>Shop name</label>
              <input type="text" id="auth-shop-name" required autocomplete="organization" />
            </div>
            <div class="field">
              <label>Your name</label>
              <input type="text" id="auth-owner-name" required autocomplete="name" />
            </div>
            <div class="field">
              <label>Invite code</label>
              <input type="text" id="auth-signup-code" autocomplete="off" />
            </div>
          ` : ''}
          <div class="field">
            <label>Email</label>
            <input type="email" id="auth-email" required autocomplete="email" />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="auth-password" required minlength="8" autocomplete="${isSignup ? 'new-password' : 'current-password'}" />
          </div>
          <button type="submit" class="btn btn-primary btn-block">${isSignup ? 'Create account' : 'Log in'}</button>
        </form>
      </div>
    </div>
  `;
  app.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      authMode = btn.dataset.authTab;
      authError = '';
      renderAuthScreen();
    });
  });
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    authError = '';
    try {
      const user = isSignup
        ? await api('/api/auth/signup', {
            method: 'POST',
            body: {
              shopName: document.getElementById('auth-shop-name').value.trim(),
              ownerName: document.getElementById('auth-owner-name').value.trim(),
              signupCode: document.getElementById('auth-signup-code').value.trim(),
              email,
              password,
            },
          })
        : await api('/api/auth/login', { method: 'POST', body: { email, password } });
      currentUser = user;
      await loadAndApplyShopTheme();
      renderShell();
      renderRoute();
    } catch (err) {
      authError = err.message;
      renderAuthScreen();
    }
  });
}

// ---------------- Colour scheme ----------------
// Shop-configurable via Edit Shop > Colours. Only the preset key is stored
// server-side (GET/PUT /api/shop-theme) - these are the only two places
// that actually know what each key looks like.

// accent is the lighter of each pair (active pills, focus outlines, hover
// borders, subnav/auth tabs - anywhere var(--accent) is used); topbar is
// the darker tone used only for the top bar itself (var(--accent-dark)).
const THEME_PRESETS = {
  forest: { name: 'Forest Green', topbar: '#164f42', accent: '#1f6f5c', modalBg: '#DDF7DF' },
  ocean: { name: 'Ocean Blue', topbar: '#1a3f66', accent: '#2f5f96', modalBg: '#DCEBFA' },
  sunset: { name: 'Sunset', topbar: '#7a3410', accent: '#a8501e', modalBg: '#FBE8D6' },
  slate: { name: 'Slate', topbar: '#2c333a', accent: '#4a5560', modalBg: '#E6E9EC' },
  plum: { name: 'Plum', topbar: '#4a2258', accent: '#7a4a94', modalBg: '#F0E4F7' },
};

function applyShopTheme(presetKey) {
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.forest;
  shopThemePreset = THEME_PRESETS[presetKey] ? presetKey : 'forest';
  document.documentElement.style.setProperty('--accent-dark', preset.topbar);
  document.documentElement.style.setProperty('--accent', preset.accent);
  document.documentElement.style.setProperty('--modal-bg', preset.modalBg);
}

async function loadAndApplyShopTheme() {
  try {
    const theme = await api('/api/shop-theme');
    applyShopTheme(theme.preset);
  } catch (_) {
    applyShopTheme('forest');
  }
}

// ---------------- Init ----------------

async function boot() {
  try {
    currentUser = await api('/api/auth/me');
  } catch (_) {
    currentUser = null;
  }
  if (currentUser) {
    await loadAndApplyShopTheme();
    renderShell();
    renderRoute();
  } else {
    renderAuthScreen();
  }
}

boot();
