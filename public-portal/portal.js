// Wheelhouse EPOS - customer booking portal. Vanilla JS, no framework, no
// build step - same philosophy as the staff app (public/app.js), but a
// wholly separate small bundle: different audience, different auth, and
// the staff diary's pixel-positioned week/month grid isn't reused here -
// customers get a simpler day-at-a-time list of bookable slots, which
// works far better on a phone (the realistic device most customers will
// use to book).
'use strict';

// ---------------- State ----------------

let shopSlug = '';
let currentCustomer = null; // { id, email, name, shopName, shopSlug } or null when signed out
let mechanics = [];
let openingTime = '09:00';
let closingTime = '18:00';
let openingDays = [0, 1, 2, 3, 4, 5, 6];
let selectedMechanicId = null;
let selectedDate = todayStr();
let busySlots = []; // busy {mechanicId, jobDate, startTime, endTime} blocks for the selected mechanic+date
let bikes = [];
let bookings = [];
let view = 'picker'; // 'picker' | 'auth' | 'booking-form' | 'my-bookings'
let authMode = 'login'; // 'login' | 'signup'
let pendingSlot = null; // startTime the customer picked, carried across a login/signup detour

const SLOT_INTERVAL_MIN = 30;
const DEFAULT_JOB_DURATION_MIN = 60; // matches the shop's own default (server/server.js resolveJobTimes)

// ---------------- Helpers ----------------

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Local calendar-date components, not .toISOString() (which converts to
// UTC and rolls back a day whenever local time is ahead of UTC and it's
// past local midnight - e.g. BST, UTC+1 - a real bug this fixes, not a
// hypothetical one).
function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateToStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() {
  return dateToStr(new Date());
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

function fmtDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function generateSlots() {
  const startMin = timeToMinutes(openingTime);
  const endMin = timeToMinutes(closingTime);
  const slots = [];
  for (let m = startMin; m + DEFAULT_JOB_DURATION_MIN <= endMin; m += SLOT_INTERVAL_MIN) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

function isSlotBusy(startTime) {
  const slotStart = timeToMinutes(startTime);
  const slotEnd = slotStart + DEFAULT_JOB_DURATION_MIN;
  return busySlots.some((b) => {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    return slotStart < bEnd && bStart < slotEnd;
  });
}

function showToast(msg) {
  let holder = document.getElementById('portal-toast');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'portal-toast';
    holder.style.cssText =
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 18px;border-radius:8px;font-size:13.5px;z-index:999;';
    document.body.appendChild(holder);
  }
  holder.textContent = msg;
  holder.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (holder.style.display = 'none'), 3000);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/portal/${shopSlug}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    // no body
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------------- Data loading ----------------

async function loadMechanicsAndHours() {
  const data = await api('/mechanics');
  mechanics = data.mechanics;
  openingTime = data.openingTime;
  closingTime = data.closingTime;
  openingDays = data.openingDays;
  if (selectedMechanicId === null && mechanics.length) selectedMechanicId = mechanics[0].id;
}

async function loadBusySlots() {
  if (!selectedMechanicId) {
    busySlots = [];
    return;
  }
  busySlots = await api(`/availability?mechanicId=${selectedMechanicId}&start=${selectedDate}&end=${selectedDate}`);
}

async function loadBikes() {
  bikes = currentCustomer ? await api('/bikes') : [];
}

async function loadBookings() {
  bookings = currentCustomer ? await api('/bookings') : [];
}

// ---------------- Boot ----------------

async function boot() {
  shopSlug = (location.pathname.replace(/^\/book\/?/, '').split('/')[0] || '').trim();
  const app = document.getElementById('app');
  if (!shopSlug) {
    app.innerHTML = `<div class="portal-shell"><div class="empty-state">No shop specified — check the link you were given.</div></div>`;
    return;
  }
  try {
    currentCustomer = await api('/me');
  } catch (_) {
    currentCustomer = null;
  }
  try {
    await loadMechanicsAndHours();
  } catch (err) {
    app.innerHTML = `<div class="portal-shell"><div class="empty-state">Couldn't load this shop's booking page. ${esc(err.message)}</div></div>`;
    return;
  }
  await render();
}

// ---------------- Rendering ----------------

async function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="portal-shell">
      ${renderHeaderHtml()}
      <div id="portal-content"></div>
    </div>
  `;
  wireHeader();
  if (view === 'auth') return renderAuthView();
  if (view === 'booking-form') return renderBookingFormView();
  if (view === 'my-bookings') return renderMyBookingsView();
  return renderPickerView();
}

function renderHeaderHtml() {
  return `
    <div class="portal-header">
      <div>
        <h1>🚲 Book a workshop slot</h1>
        ${currentCustomer ? `<div class="muted">Signed in as ${esc(currentCustomer.name || currentCustomer.email)}</div>` : ''}
      </div>
      <div>
        ${
          currentCustomer
            ? `<button class="btn btn-sm" id="my-bookings-btn">My bookings</button>
               <button class="btn btn-sm btn-ghost" id="logout-btn">Log out</button>`
            : `<button class="btn btn-sm btn-primary" id="login-btn">Log in</button>`
        }
      </div>
    </div>
  `;
}

function wireHeader() {
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.addEventListener('click', () => { authMode = 'login'; view = 'auth'; render(); });
  const myBookingsBtn = document.getElementById('my-bookings-btn');
  if (myBookingsBtn) myBookingsBtn.addEventListener('click', async () => { await loadBookings(); view = 'my-bookings'; render(); });
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    currentCustomer = null;
    view = 'picker';
    render();
  });
}

// ---- Picker: pick a mechanic, a day, then a slot ----

async function renderPickerView() {
  const content = document.getElementById('portal-content');
  content.innerHTML = `<div class="empty-state">Loading availability…</div>`;
  try {
    await loadBusySlots();
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
    return;
  }

  const dow = new Date(selectedDate + 'T00:00:00').getDay();
  const shopClosed = !openingDays.includes(dow);
  const slots = generateSlots();

  content.innerHTML = `
    <div class="mechanic-select-row">
      ${mechanics
        .map(
          (m) =>
            `<button class="pill ${m.id === selectedMechanicId ? 'active' : ''}" data-mech="${m.id}">${esc(m.name)}</button>`
        )
        .join('')}
    </div>
    <div class="portal-day-nav">
      <button class="btn btn-sm" id="day-prev">‹</button>
      <div class="day-label">${esc(fmtDateLabel(selectedDate))}</div>
      <button class="btn btn-sm" id="day-next">›</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        ${
          !mechanics.length
            ? `<div class="empty-state">This shop hasn't set up any mechanics yet.</div>`
            : shopClosed
              ? `<div class="empty-state">Closed on this day - try another.</div>`
              : `<div class="slot-grid">
                  ${slots
                    .map((s) => {
                      const busy = isSlotBusy(s);
                      return `<button class="slot-btn ${busy ? 'busy' : ''}" ${busy ? 'disabled' : ''} data-slot="${s}">${s}</button>`;
                    })
                    .join('')}
                </div>`
        }
      </div>
    </div>
  `;

  content.querySelectorAll('button[data-mech]').forEach((b) =>
    b.addEventListener('click', () => {
      selectedMechanicId = Number(b.dataset.mech);
      renderPickerView();
    })
  );
  document.getElementById('day-prev').addEventListener('click', () => {
    selectedDate = addDays(selectedDate, -1);
    renderPickerView();
  });
  document.getElementById('day-next').addEventListener('click', () => {
    selectedDate = addDays(selectedDate, 1);
    renderPickerView();
  });
  content.querySelectorAll('button[data-slot]').forEach((b) =>
    b.addEventListener('click', () => {
      pendingSlot = b.dataset.slot;
      if (!currentCustomer) {
        authMode = 'login';
        view = 'auth';
      } else {
        view = 'booking-form';
      }
      render();
    })
  );
}

// ---- Auth: login or signup, then continue to the booking form if a slot was picked ----

function renderAuthView() {
  const content = document.getElementById('portal-content');
  content.innerHTML = `
    <div class="portal-tabs">
      <button class="pill ${authMode === 'login' ? 'active' : ''}" id="tab-login">Log in</button>
      <button class="pill ${authMode === 'signup' ? 'active' : ''}" id="tab-signup">Create account</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        <form id="auth-form">
          ${authMode === 'signup' ? `<div class="field"><label for="f-name">Your name *</label><input id="f-name" type="text" required /></div>` : ''}
          <div class="field"><label for="f-email">Email *</label><input id="f-email" type="email" required /></div>
          <div class="field"><label for="f-password">Password *</label><input id="f-password" type="password" required minlength="8" /></div>
          <button type="submit" class="btn btn-primary btn-block">${authMode === 'signup' ? 'Create account' : 'Log in'}</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById('tab-login').addEventListener('click', () => { authMode = 'login'; renderAuthView(); });
  document.getElementById('tab-signup').addEventListener('click', () => { authMode = 'signup'; renderAuthView(); });
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('f-email').value.trim();
    const password = document.getElementById('f-password').value;
    try {
      if (authMode === 'signup') {
        const name = document.getElementById('f-name').value.trim();
        currentCustomer = await api('/signup', { method: 'POST', body: { name, email, password } });
      } else {
        await api('/login', { method: 'POST', body: { email, password } });
        currentCustomer = await api('/me');
      }
      showToast(`Welcome${currentCustomer.name ? ', ' + currentCustomer.name : ''}!`);
      view = pendingSlot ? 'booking-form' : 'picker';
      render();
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ---- Booking form: bike (existing or new) + description, for the slot already picked ----

async function renderBookingFormView() {
  const content = document.getElementById('portal-content');
  if (!pendingSlot) {
    view = 'picker';
    return renderPickerView();
  }
  content.innerHTML = `<div class="empty-state">Loading…</div>`;
  try {
    await loadBikes();
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
    return;
  }
  const mechanic = mechanics.find((m) => m.id === selectedMechanicId);

  content.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h2>Book ${esc(fmtDateLabel(selectedDate))} at ${esc(pendingSlot)}${mechanic ? ` with ${esc(mechanic.name)}` : ''}</h2></div>
      <div class="panel-body">
        <form id="booking-form">
          <div class="field">
            <label for="f-bike">Bike</label>
            <select id="f-bike">
              ${bikes.map((b) => `<option value="${b.id}">${esc([b.make, b.model].filter(Boolean).join(' ') || 'Bike')}</option>`).join('')}
              <option value="__new__">+ Add a new bike</option>
            </select>
          </div>
          <div class="inline-subform" id="new-bike-fields" style="${bikes.length ? 'display:none;' : ''}">
            <div class="field-row">
              <div class="field"><label for="f-bike-make">Make</label><input id="f-bike-make" type="text" /></div>
              <div class="field"><label for="f-bike-model">Model</label><input id="f-bike-model" type="text" /></div>
            </div>
            <div class="field-row">
              <div class="field"><label for="f-bike-colour">Colour</label><input id="f-bike-colour" type="text" /></div>
              <div class="field"><label for="f-bike-serial">Serial number</label><input id="f-bike-serial" type="text" /></div>
            </div>
          </div>
          <div class="field">
            <label for="f-description">What do you need done? *</label>
            <textarea id="f-description" rows="3" required placeholder="e.g. Squeaky brakes, annual service…"></textarea>
          </div>
          <div class="field-row">
            <button type="button" class="btn" id="booking-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-block">Request booking</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const bikeSelect = document.getElementById('f-bike');
  const newBikeFields = document.getElementById('new-bike-fields');
  bikeSelect.addEventListener('change', () => {
    newBikeFields.style.display = bikeSelect.value === '__new__' ? '' : 'none';
  });

  document.getElementById('booking-cancel').addEventListener('click', () => {
    pendingSlot = null;
    view = 'picker';
    render();
  });

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      mechanicId: selectedMechanicId,
      jobDate: selectedDate,
      startTime: pendingSlot,
      description: document.getElementById('f-description').value.trim(),
    };
    if (bikeSelect.value === '__new__') {
      body.newBike = {
        make: document.getElementById('f-bike-make').value.trim(),
        model: document.getElementById('f-bike-model').value.trim(),
        colour: document.getElementById('f-bike-colour').value.trim(),
        serialNumber: document.getElementById('f-bike-serial').value.trim(),
      };
    } else if (bikeSelect.value) {
      body.bikeId = Number(bikeSelect.value);
    }
    try {
      await api('/bookings', { method: 'POST', body });
      showToast('Booking requested — the shop will confirm it shortly.');
      pendingSlot = null;
      view = 'my-bookings';
      await loadBookings();
      render();
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ---- My bookings: their own booking history and its status ----

async function renderMyBookingsView() {
  const content = document.getElementById('portal-content');
  content.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2>My bookings</h2>
        <button class="btn btn-sm" id="back-to-picker">+ New booking</button>
      </div>
      <div class="panel-body">
        ${
          !bookings.length
            ? `<div class="empty-state">No bookings yet.</div>`
            : bookings
                .map(
                  (b) => `
              <div class="booking-list-item">
                <div>
                  <div><strong>${esc(b.jobDate)}${b.startTime ? ` at ${esc(b.startTime)}` : ''}</strong></div>
                  <div class="muted">${esc(b.notes || b.title || '')}${b.mechanicName ? ` · ${esc(b.mechanicName)}` : ''}</div>
                </div>
                <span class="badge status-${esc(b.status)}">${esc(b.status)}</span>
              </div>
            `
                )
                .join('')
        }
      </div>
    </div>
  `;
  document.getElementById('back-to-picker').addEventListener('click', () => {
    view = 'picker';
    render();
  });
}

boot();
