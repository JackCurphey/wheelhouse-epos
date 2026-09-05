// Wheelhouse EPOS - customer booking portal. Vanilla JS, no framework, no
// build step - same philosophy as the staff app (public/app.js), but a
// wholly separate small bundle: different audience, different auth.
//
// The availability picker deliberately reuses the staff Workshop diary's
// own week-grid look (.week-grid/.wk-day-header/.wk-day-col/etc, all from
// the shared /styles.css) so customers see the same thing staff do -
// closed days greyed exactly like a mechanic's day off, and already-booked
// time shown with the same hatched pattern, just without any job details
// (privacy - see server/server.js's /availability route, which only ever
// returns mechanic/date/time, never a title, customer name, or notes).
'use strict';

// ---------------- State ----------------

let shopSlug = '';
let currentCustomer = null; // { id, email, name, shopName, shopSlug } or null when signed out
let mechanics = []; // [{ id, name, workingDays }]
let jobTypes = []; // [{ value, label, minutes }] - server-defined, so duration estimates live in one place
let openingTime = '09:00';
let closingTime = '18:00';
let openingDays = [0, 1, 2, 3, 4, 5, 6];
let selectedMechanicIds = []; // 1+ mechanic ids currently shown - matches staff's multi-select split-view diary
let selectedWeekStart = null; // 'YYYY-MM-DD', Monday of the displayed week
let busySlots = []; // {mechanicId, jobDate, startTime, endTime} for every selected mechanic across the displayed week
let fullDays = []; // {mechanicId, jobDate} - days already under workshop_settings.full_day_threshold_minutes of free time, treated like a closed day
let bikes = [];
let bookings = [];
let view = 'picker'; // 'picker' | 'auth' | 'booking-form' | 'my-bookings'
let authMode = 'login'; // 'login' | 'signup' | 'guest'
let pendingDate = null; // date the customer clicked on the grid, carried across a login/signup detour
let pendingSlot = null; // time the customer clicked on the grid, carried across a login/signup detour
let pendingMechanicId = null; // which mechanic's column was clicked, carried across a login/signup detour
// Set once someone chooses "Continue without an account" - carried for the
// rest of this visit (like currentCustomer is) so later slot clicks go
// straight to the booking form instead of asking again. Never sent to /me
// or persisted anywhere; just enough to fill guestName/guestPhone on submit.
let pendingGuestName = null;
let pendingGuestPhone = null;
// What was just booked, captured before the pending* vars are cleared, so the
// confirmation view can state it back. A guest has no booking history to fall
// back on, so for them this is the only record they ever see.
let lastBooking = null;

// Used only for the initial grid click (busy-check and the max clickable
// start time) - the actual duration a booking gets is whatever job type
// the customer picks in the form afterward (server/server.js's
// PORTAL_JOB_TYPES). A slot that looks free under this 60-min proxy but
// turns out too short once a longer job type is chosen just becomes a
// second overlapping pending request, same as any other conflict - staff
// catch it at approval, same tradeoff the rest of this booking flow
// already makes.
const DEFAULT_JOB_DURATION_MIN = 60;
const WORKSHOP_ROW_PX = 48; // matches the staff diary's own row height exactly, for the same visual scale

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

function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  date.setDate(date.getDate() + diff);
  return date;
}

function weekDays(weekStartStr) {
  const start = new Date(weekStartStr + 'T00:00:00');
  return [...Array(7)].map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function fmtDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtWeekRangeLabel(startDate, endDate) {
  const s = startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const e = endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${s} – ${e}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

// Recomputed whenever the shop's opening hours load - mirrors
// applyWorkshopHours() in public/app.js exactly, so the grid is the same
// vertical scale customers see as staff do.
let gridHourStart = 9;
let gridHourEnd = 18;
let gridHeight = (gridHourEnd - gridHourStart) * WORKSHOP_ROW_PX;
let gridMinMinutes = gridHourStart * 60;
let gridMaxMinutes = gridHourEnd * 60;

function applyGridHours() {
  gridHourStart = parseInt((openingTime || '09:00').split(':')[0], 10);
  gridHourEnd = parseInt((closingTime || '18:00').split(':')[0], 10);
  gridHeight = (gridHourEnd - gridHourStart) * WORKSHOP_ROW_PX;
  gridMinMinutes = gridHourStart * 60;
  gridMaxMinutes = gridHourEnd * 60;
}

function minutesToGridPx(mins) {
  return ((mins - gridMinMinutes) / 60) * WORKSHOP_ROW_PX;
}

// Inverse of minutesToGridPx, snapped to 30-minute slots and clamped so the
// resulting start time always leaves room for the default 1-hour job
// duration before closing.
function timeFromGridY(y) {
  const rawMinutes = gridMinMinutes + (y / WORKSHOP_ROW_PX) * 60;
  const snapped = Math.round(rawMinutes / 30) * 30;
  const maxStart = gridMaxMinutes - DEFAULT_JOB_DURATION_MIN;
  return minutesToTime(Math.max(gridMinMinutes, Math.min(maxStart, snapped)));
}

function isDayOff(d, mechanicId) {
  const dow = d.getDay();
  if (!openingDays.includes(dow)) return true;
  const mech = mechanics.find((m) => m.id === mechanicId);
  return !!mech && !mech.workingDays.includes(dow);
}

function isDayFull(d, mechanicId) {
  const dateStr = dateToStr(d);
  return fullDays.some((f) => f.mechanicId === mechanicId && f.jobDate === dateStr);
}

function isSlotBusy(dateStr, startTime, mechanicId) {
  const slotStart = timeToMinutes(startTime);
  const slotEnd = slotStart + DEFAULT_JOB_DURATION_MIN;
  return busySlots.some((b) => {
    if (b.jobDate !== dateStr || b.mechanicId !== mechanicId) return false;
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    return slotStart < bEnd && bStart < slotEnd;
  });
}

// The grid only ever checks a fixed DEFAULT_JOB_DURATION_MIN when deciding
// what looks free (see isSlotBusy above) - the job type, picked afterward
// in the booking form, can run longer than that. This re-checks the actual
// chosen duration against closing time and every other booked slot, so the
// customer finds out before submitting rather than from a rejected request.
// The server re-validates the same thing authoritatively either way.
function jobTypeFitError(jobTypeValue) {
  const jobType = jobTypes.find((t) => t.value === jobTypeValue);
  if (!jobType || !pendingSlot) return null;
  const start = timeToMinutes(pendingSlot);
  const end = start + jobType.minutes;
  if (start < timeToMinutes(openingTime) || end > timeToMinutes(closingTime)) {
    return `That doesn't fit before closing (${closingTime}) - please pick an earlier time or a shorter job type.`;
  }
  const clash = busySlots.some((b) => {
    if (b.jobDate !== pendingDate || b.mechanicId !== pendingMechanicId) return false;
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    return start < bEnd && bStart < end;
  });
  if (clash) return 'That runs into another booking for this mechanic - please pick an earlier time or a shorter job type.';
  return null;
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
  jobTypes = data.jobTypes || [];
  openingTime = data.openingTime;
  closingTime = data.closingTime;
  openingDays = data.openingDays;
  applyGridHours();
  // Default to every mechanic shown side by side, matching the staff
  // diary's own default - only on first load (loadMechanicsAndHours() can
  // be called again later without this clobbering a filter the customer
  // has since changed, same guard as app.js's loadMechanics()).
  if (!selectedMechanicIds.length && mechanics.length) selectedMechanicIds = mechanics.map((m) => m.id);
}

async function loadBusySlots() {
  if (!selectedMechanicIds.length) {
    busySlots = [];
    fullDays = [];
    return;
  }
  const days = weekDays(selectedWeekStart);
  const start = dateToStr(days[0]);
  const end = dateToStr(days[6]);
  // One request per selected mechanic (the endpoint filters to one at a
  // time) rather than widening it to accept several - this is a handful of
  // small parallel requests over a 7-day range, not worth the extra API
  // surface for.
  const results = await Promise.all(
    selectedMechanicIds.map((id) => api(`/availability?mechanicId=${id}&start=${start}&end=${end}`))
  );
  busySlots = results.flatMap((r) => r.busy);
  fullDays = results.flatMap((r) => r.fullDays);
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
  selectedWeekStart = dateToStr(startOfWeek(new Date()));
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
  // The week grid needs more horizontal room than the narrow auth/
  // booking-form/my-bookings panels do.
  const wideClass = view === 'picker' ? ' wide' : '';
  app.innerHTML = `
    <div class="portal-shell${wideClass}">
      ${renderHeaderHtml()}
      <div id="portal-content"></div>
    </div>
  `;
  wireHeader();
  if (view === 'auth') return renderAuthView();
  if (view === 'booking-form') return renderBookingFormView();
  if (view === 'confirmed') return renderConfirmedView();
  if (view === 'my-bookings') return renderMyBookingsView();
  return renderPickerView();
}

function renderHeaderHtml() {
  return `
    <div class="portal-header">
      <div>
        <h1>🚲 Book a workshop slot</h1>
        ${currentCustomer ? `<div class="muted">Signed in as ${esc(currentCustomer.name || currentCustomer.email)}</div>` : ''}
        ${!currentCustomer && pendingGuestName ? `<div class="muted">Booking as ${esc(pendingGuestName)} (no account)</div>` : ''}
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

// ---- Picker: the same week-diary look staff see, read-only, one mechanic
// at a time - closed days greyed like a day off, already-booked time shown
// hatched with no details, click any open time to start a booking. ----

// Builds one mechanic's week grid (day headers + hour labels + day columns)
// - the same markup buildWeekGridHtml() in public/app.js builds for staff,
// scoped to a single mechanicId so it can be reused for either the solo
// view or one column of the split multi-mechanic view below.
function buildMechanicGridHtml(days, mechanicId, todayIso) {
  const dayHeadersHtml = days
    .map((d) => {
      const dateStr = dateToStr(d);
      const dayOff = isDayOff(d, mechanicId);
      const full = !dayOff && isDayFull(d, mechanicId);
      return `
      <div class="wk-day-header ${dateStr === todayIso ? 'today' : ''} ${dayOff ? 'day-off' : ''} ${full ? 'day-full' : ''}">
        <span class="wd-name">${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))}</span>
        <span class="wd-date">${esc(d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }))}</span>
        <span class="wd-full-badge">Full</span>
      </div>`;
    })
    .join('');

  let hourLabelsHtml = '';
  for (let h = gridHourStart; h < gridHourEnd; h++) {
    const top = (h - gridHourStart) * WORKSHOP_ROW_PX;
    hourLabelsHtml += `<div class="wk-hour-label" style="top:${top}px;">${String(h).padStart(2, '0')}:00</div>`;
  }

  const dayColsHtml = days
    .map((d) => {
      const dateStr = dateToStr(d);
      const dayOff = isDayOff(d, mechanicId);
      const full = !dayOff && isDayFull(d, mechanicId);
      const blocked = dayOff || full;
      let blocksHtml = '';
      if (!blocked) {
        blocksHtml = busySlots
          .filter((b) => b.jobDate === dateStr && b.mechanicId === mechanicId)
          .map((b) => {
            const startMin = timeToMinutes(b.startTime);
            const endMin = timeToMinutes(b.endTime);
            const top = minutesToGridPx(Math.max(startMin, gridMinMinutes));
            const bottom = minutesToGridPx(Math.min(endMin, gridMaxMinutes));
            const height = Math.max(18, bottom - top);
            return `<div class="portal-busy-block" style="top:${top}px; height:${height}px;">Unavailable</div>`;
          })
          .join('');
      }
      return `
      <div class="wk-day-col ${dateStr === todayIso ? 'today' : ''} ${dayOff ? 'day-off' : ''} ${full ? 'day-full' : ''}" data-date="${dateStr}" data-mechanic="${mechanicId}" style="height:${gridHeight}px;">
        ${blocksHtml}
        ${blocked ? '' : '<div class="hover-preview" style="display:none;"></div>'}
      </div>`;
    })
    .join('');

  return `
    <div class="wk-corner"></div>
    ${dayHeadersHtml}
    <div class="wk-hour-labels" style="height:${gridHeight}px;">${hourLabelsHtml}</div>
    ${dayColsHtml}
  `;
}

async function renderPickerView() {
  const content = document.getElementById('portal-content');
  content.innerHTML = `<div class="empty-state">Loading availability…</div>`;
  try {
    await loadBusySlots();
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
    return;
  }

  const days = weekDays(selectedWeekStart);
  const todayIso = todayStr();
  const selectedMechs = mechanics.filter((m) => selectedMechanicIds.includes(m.id));

  // Matches staff's own diary exactly: one mechanic selected is a single
  // plain grid; 2+ selected splits into side-by-side mini-diaries, each
  // labelled with that mechanic's name, so a customer with no particular
  // preference can compare everyone's availability at once.
  const diariesHtml = !mechanics.length
    ? `<div class="empty-state">This shop hasn't set up any mechanics yet.</div>`
    : selectedMechs.length <= 1
      ? `<div class="week-diaries">
          <div class="week-diary">
            <div class="week-grid-scroll"><div class="week-grid">${buildMechanicGridHtml(days, selectedMechs[0]?.id, todayIso)}</div></div>
          </div>
        </div>`
      : `<div class="week-diaries split">
          ${selectedMechs
            .map(
              (m) => `
            <div class="week-diary">
              <div class="week-diary-title">${esc(m.name)}</div>
              <div class="week-grid-scroll"><div class="week-grid">${buildMechanicGridHtml(days, m.id, todayIso)}</div></div>
            </div>
          `
            )
            .join('')}
        </div>`;

  content.innerHTML = `
    <div class="mechanic-select-row">
      ${mechanics
        .map(
          (m) =>
            `<button class="pill ${selectedMechanicIds.includes(m.id) ? 'active' : ''}" data-mech="${m.id}">${esc(m.name)}</button>`
        )
        .join('')}
    </div>
    <div class="portal-week-nav">
      <button class="btn btn-sm" id="week-prev">‹ Prev</button>
      <div class="week-label">${esc(fmtWeekRangeLabel(days[0], days[6]))}</div>
      <button class="btn btn-sm" id="week-next">Next ›</button>
    </div>
    <div class="portal-legend">
      ${PortalCopy.DIARY_LEGEND.map(
        (entry) => `<span class="legend-item"><span class="legend-swatch swatch-${esc(entry.key)}"></span>${esc(entry.label)}</span>`
      ).join('')}
    </div>
    ${diariesHtml}
  `;

  content.querySelectorAll('button[data-mech]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = Number(b.dataset.mech);
      const next = selectedMechanicIds.includes(id)
        ? selectedMechanicIds.filter((x) => x !== id)
        : [...selectedMechanicIds, id];
      if (next.length) selectedMechanicIds = next; // always keep at least one selected
      renderPickerView();
    })
  );
  const prevBtn = document.getElementById('week-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    selectedWeekStart = addDays(selectedWeekStart, -7);
    renderPickerView();
  });
  const nextBtn = document.getElementById('week-next');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    selectedWeekStart = addDays(selectedWeekStart, 7);
    renderPickerView();
  });

  // Busy blocks are pointer-events:none (see portal.css), so a click always
  // lands on the day column itself - re-checking busy-ness here catches
  // clicks right at a block's edge. data-mechanic on the column (set in
  // buildMechanicGridHtml) is what tells split-view clicks apart.
  content.querySelectorAll('.wk-day-col:not(.day-off):not(.day-full)').forEach((col) => {
    const preview = col.querySelector('.hover-preview');
    if (preview) {
      col.addEventListener('mousemove', (e) => {
        const rect = col.getBoundingClientRect();
        const time = timeFromGridY(e.clientY - rect.top);
        const startMin = timeToMinutes(time);
        const top = minutesToGridPx(startMin);
        const bottom = minutesToGridPx(startMin + DEFAULT_JOB_DURATION_MIN);
        preview.style.top = `${top}px`;
        preview.style.height = `${Math.max(18, bottom - top)}px`;
        preview.style.display = '';
        const busy = isSlotBusy(col.dataset.date, time, Number(col.dataset.mechanic));
        preview.classList.toggle('unavailable', busy);
        preview.textContent = busy ? 'Busy' : time;
      });
      col.addEventListener('mouseleave', () => {
        preview.style.display = 'none';
      });
    }
    col.addEventListener('click', (e) => {
      const rect = col.getBoundingClientRect();
      const time = timeFromGridY(e.clientY - rect.top);
      const dateStr = col.dataset.date;
      const mechanicId = Number(col.dataset.mechanic);
      if (isSlotBusy(dateStr, time, mechanicId)) {
        showToast("That time isn't available");
        return;
      }
      pendingDate = dateStr;
      pendingSlot = time;
      pendingMechanicId = mechanicId;
      if (!currentCustomer && !pendingGuestName) {
        authMode = 'login';
        view = 'auth';
      } else {
        view = 'booking-form';
      }
      render();
    });
  });
}

// ---- Auth: login or signup, then continue to the booking form if a slot was picked ----

function renderAuthView() {
  const content = document.getElementById('portal-content');
  content.innerHTML = `
    <div class="portal-tabs">
      <button class="pill ${authMode === 'login' ? 'active' : ''}" id="tab-login">Log in</button>
      <button class="pill ${authMode === 'signup' ? 'active' : ''}" id="tab-signup">Create account</button>
      <button class="pill ${authMode === 'guest' ? 'active' : ''}" id="tab-guest">Continue without an account</button>
    </div>
    <div class="panel">
      <div class="panel-body">
        <form id="auth-form">
          ${authMode === 'guest'
            ? `<div class="field"><label for="f-guest-name">Your name *</label><input id="f-guest-name" type="text" required /></div>
               <div class="field"><label for="f-guest-phone">Phone number *</label><input id="f-guest-phone" type="tel" required /></div>
               <div class="muted" style="margin-bottom:10px;">We'll use this to contact you about your booking. Without an account you won't be able to see your booking history later.</div>`
            : `${authMode === 'signup' ? `<div class="field"><label for="f-name">Your name *</label><input id="f-name" type="text" required /></div>` : ''}
               <div class="field"><label for="f-email">Email *</label><input id="f-email" type="email" required /></div>
               <div class="field"><label for="f-password">Password *</label><input id="f-password" type="password" required minlength="8" /></div>`
          }
          <button type="submit" class="btn btn-primary btn-block">${authMode === 'signup' ? 'Create account' : authMode === 'guest' ? 'Continue' : 'Log in'}</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById('tab-login').addEventListener('click', () => { authMode = 'login'; renderAuthView(); });
  document.getElementById('tab-signup').addEventListener('click', () => { authMode = 'signup'; renderAuthView(); });
  document.getElementById('tab-guest').addEventListener('click', () => { authMode = 'guest'; renderAuthView(); });
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authMode === 'guest') {
      const name = document.getElementById('f-guest-name').value.trim();
      const phone = document.getElementById('f-guest-phone').value.trim();
      if (!name || !phone) return showToast('Please enter your name and phone number');
      pendingGuestName = name;
      pendingGuestPhone = phone;
      view = pendingSlot ? 'booking-form' : 'picker';
      render();
      return;
    }
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
      pendingGuestName = null;
      pendingGuestPhone = null;
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
  if (!pendingSlot || !pendingDate || !pendingMechanicId) {
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
  const mechanic = mechanics.find((m) => m.id === pendingMechanicId);

  content.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h2>Book ${esc(fmtDateLabel(pendingDate))} at ${esc(pendingSlot)}${mechanic ? ` with ${esc(mechanic.name)}` : ''}</h2></div>
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
            <label for="f-job-type">What kind of job is this? *</label>
            <select id="f-job-type" required>
              <option value="" disabled ${jobTypes.length ? 'selected' : ''}>Choose the closest match…</option>
              ${jobTypes
                .map((t) => {
                  // The duration was always known here (PORTAL_JOB_TYPES sends
                  // it, and jobTypeFitError already checks against it) - it
                  // just used to reach the customer only as an error after
                  // they had picked something too long.
                  const d = PortalCopy.formatDuration(t.minutes);
                  return `<option value="${esc(t.value)}">${esc(t.label)}${d ? ` — about ${esc(d)}` : ''}</option>`;
                })
                .join('')}
            </select>
            <div class="field-error" id="f-job-type-error" style="display:none;"></div>
          </div>
          <div class="field">
            <label for="f-description">What do you need done? *</label>
            <textarea id="f-description" rows="3" required placeholder="e.g. Squeaky brakes, annual service…"></textarea>
          </div>
          <div class="field-row">
            <button type="button" class="btn" id="booking-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary btn-block" id="booking-submit">Request booking</button>
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

  const jobTypeSelect = document.getElementById('f-job-type');
  const jobTypeError = document.getElementById('f-job-type-error');
  const submitBtn = document.getElementById('booking-submit');
  jobTypeSelect.addEventListener('change', () => {
    const message = jobTypeFitError(jobTypeSelect.value);
    jobTypeError.textContent = message || '';
    jobTypeError.style.display = message ? '' : 'none';
    submitBtn.disabled = !!message;
  });

  document.getElementById('booking-cancel').addEventListener('click', () => {
    pendingDate = null;
    pendingSlot = null;
    pendingMechanicId = null;
    view = 'picker';
    render();
  });

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const jobTypeValue = document.getElementById('f-job-type').value;
    const fitError = jobTypeFitError(jobTypeValue);
    if (fitError) {
      jobTypeError.textContent = fitError;
      jobTypeError.style.display = '';
      return;
    }
    const body = {
      mechanicId: pendingMechanicId,
      jobDate: pendingDate,
      startTime: pendingSlot,
      jobType: jobTypeValue,
      description: document.getElementById('f-description').value.trim(),
    };
    if (!currentCustomer) {
      body.guestName = pendingGuestName;
      body.guestPhone = pendingGuestPhone;
    }
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
      const jobType = jobTypes.find((t) => t.value === jobTypeValue);
      const mechanic = mechanics.find((m) => m.id === pendingMechanicId);
      lastBooking = {
        jobDate: pendingDate,
        startTime: pendingSlot,
        mechanicName: mechanic ? mechanic.name : '',
        jobTypeLabel: jobType ? jobType.label : '',
        minutes: jobType ? jobType.minutes : 0,
        asGuest: !currentCustomer,
      };
      pendingDate = null;
      pendingSlot = null;
      pendingMechanicId = null;
      // Both routes land on the confirmation now. It used to be a toast that
      // vanished in three seconds - which for a guest, who has no booking
      // history to return to, was the only acknowledgement they ever got.
      if (currentCustomer) await loadBookings();
      view = 'confirmed';
      render();
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ---- Confirmation: what was just booked, stated back ----

function renderConfirmedView() {
  const content = document.getElementById('portal-content');
  if (!lastBooking) {
    view = 'picker';
    return renderPickerView();
  }
  const b = lastBooking;
  const duration = PortalCopy.formatDuration(b.minutes);
  content.innerHTML = `
    <div class="panel">
      <div class="panel-header"><h2>${esc(PortalCopy.BOOKING_CONFIRMED.heading)}</h2></div>
      <div class="panel-body">
        <div class="confirmation-detail">
          <div><strong>${esc(fmtDateLabel(b.jobDate))} at ${esc(b.startTime)}</strong></div>
          ${b.mechanicName ? `<div class="muted">With ${esc(b.mechanicName)}</div>` : ''}
          ${b.jobTypeLabel ? `<div class="muted">${esc(b.jobTypeLabel)}${duration ? ` · about ${esc(duration)}` : ''}</div>` : ''}
        </div>
        <p>${esc(b.asGuest ? PortalCopy.BOOKING_CONFIRMED.guest : PortalCopy.BOOKING_CONFIRMED.account)}</p>
        <div class="field-row">
          <button class="btn" id="confirm-book-another">Book another slot</button>
          ${currentCustomer ? '<button class="btn btn-primary btn-block" id="confirm-my-bookings">See my bookings</button>' : ''}
        </div>
      </div>
    </div>
  `;
  document.getElementById('confirm-book-another').addEventListener('click', () => {
    view = 'picker';
    render();
  });
  const mine = document.getElementById('confirm-my-bookings');
  if (mine) mine.addEventListener('click', async () => {
    await loadBookings();
    view = 'my-bookings';
    render();
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
                  (b) => {
                    // b.status is the raw workshop_jobs enum - 'waiting_parts'
                    // and 'on_hold' both read as database internals. The CSS
                    // class still uses the raw value; only the words change.
                    const s = PortalCopy.statusFor(b.status);
                    return `
              <div class="booking-list-item">
                <div>
                  <div><strong>${esc(fmtDateLabel(b.jobDate))}${b.startTime ? ` at ${esc(b.startTime)}${b.endTime ? `–${esc(b.endTime)}` : ''}` : ''}</strong></div>
                  <div class="muted">${esc(b.notes || b.title || '')}${b.mechanicName ? ` · ${esc(b.mechanicName)}` : ''}</div>
                  ${s.explanation ? `<div class="muted">${esc(s.explanation)}</div>` : ''}
                </div>
                <span class="badge status-${esc(b.status)}">${esc(s.label)}</span>
              </div>
            `;
                  }
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
