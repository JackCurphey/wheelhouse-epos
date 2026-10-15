// The online booking pages' customer accounts and what they read:
// /api/portal/:shopSlug/ signup, login, logout and me, and the mechanics,
// services, terms, availability and the customer's bikes. Portal routes run
// under the dispatcher's /api/portal/ branch (server.js): signup, login and
// logout get (req, res, params, query) and resolve their own shop; the rest
// get the shop's row-level security from :shopSlug and check the customer
// themselves with currentCustomerSession(). Mark's file. Moved out of
// server.js unchanged (split plan §4.1, WP-0.4); bookings and booking links
// follow in the next move.
import { prepare, dbExec } from '../db.js';
import { badRequest, makeRateLimiter, nowIso, parseCookies, readJsonBody, sendJson } from '../lib/http.js';
import { serializeBike } from '../lib/serializers.js';
import { currentCustomerSession } from '../lib/session.js';
import { clientIp, isHttpsRequest } from '../proxy-trust.js';
import {
  CustomerAuthError, signupCustomer, verifyCustomerLogin, createCustomerSession, destroyCustomerSession,
  serializeCustomerLogin, CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MAX_AGE_SECONDS,
} from '../customer-auth.js';
import { MAX_RANGE_DAYS, isRealDate, dayCount, widestHours, startTimesFor, fitsDropoff, legacyView } from '../capacity.js';
import { earliestBookable, startIsInTime, dropoffIsInTime } from '../clock.js';
import { STANDARD_BOOKING_TERMS } from '../standard-terms.js';
import { parseWorkingDays, toCapacitySettings, loadCapacity } from '../workshop/jobs.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// Parallel to the staff ones (server/routes/auth.js) but on their own cookie name, so a
// customer session and a staff session can coexist in the same browser
// without either one clobbering the other.

function setCustomerSessionCookie(req, res, token) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${CUSTOMER_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${CUSTOMER_SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

function clearCustomerSessionCookie(res) {
  res.setHeader('Set-Cookie', `${CUSTOMER_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

const portalLoginLimiter = makeRateLimiter(10, 15 * 60 * 1000);
const portalSignupLimiter = makeRateLimiter(5, 60 * 60 * 1000);

// A second, public-facing surface (see public-portal/) for customers to
// book their own workshop slots. Its auth is entirely separate from staff
// auth (see server/customer-auth.js) - signup/login/logout manage their own
// shop resolution and session, same as /api/auth/* does for staff, and
// never touch RLS-protected tables directly. Every other /api/portal/*
// route needs the shop's RLS context (resolved from the :shopSlug in the
// URL, see the dispatcher below) to read/write customers/employees/
// workshop_jobs/etc through the normal db.prepare(...) shim.

export function register(route) {
  route('POST', '/api/portal/:shopSlug/signup', async (req, res, params) => {
    const ip = clientIp(req);
    if (!portalSignupLimiter.check(ip)) {
      return sendJson(res, 429, { error: 'Too many accounts created from this network - please try again later.' });
    }
    const body = await readJsonBody(req);
    let created;
    try {
      created = await signupCustomer({ shopSlug: params.shopSlug, email: body.email, password: body.password, name: body.name });
    } catch (err) {
      if (err instanceof CustomerAuthError) return badRequest(res, err.message);
      throw err;
    }
    const token = await createCustomerSession(created.login.id);
    setCustomerSessionCookie(req, res, token);
    sendJson(res, 201, {
      id: created.login.id,
      email: created.login.email,
      name: created.customer.name,
      shopName: created.shop.name,
      shopSlug: created.shop.slug,
    });
  });

  route('POST', '/api/portal/:shopSlug/login', async (req, res, params) => {
    const ip = clientIp(req);
    if (!portalLoginLimiter.check(ip)) {
      return sendJson(res, 429, { error: 'Too many login attempts - please wait a few minutes and try again.' });
    }
    const body = await readJsonBody(req);
    let login;
    try {
      login = await verifyCustomerLogin(params.shopSlug, body.email, body.password);
    } catch (err) {
      if (err instanceof CustomerAuthError) return sendJson(res, 401, { error: err.message });
      throw err;
    }
    portalLoginLimiter.reset(ip);
    const token = await createCustomerSession(login.id);
    setCustomerSessionCookie(req, res, token);
    sendJson(res, 200, serializeCustomerLogin(login));
  });

  route('POST', '/api/portal/:shopSlug/logout', async (req, res) => {
    const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
    await destroyCustomerSession(token);
    clearCustomerSessionCookie(res);
    sendJson(res, 200, { ok: true });
  });

  route('GET', '/api/portal/:shopSlug/me', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(ctx.login.customer_id);
    sendJson(res, 200, {
      id: ctx.login.id,
      email: ctx.login.email,
      name: customer ? customer.name : '',
      shopName: ctx.shop.name,
      shopSlug: ctx.shop.slug,
    });
  });

  // Public - no login required to see what's open, only to actually book.
  route('GET', '/api/portal/:shopSlug/mechanics', async (req, res) => {
    const mechanics = await db
      .prepare('SELECT id, name, working_days FROM employees WHERE is_mechanic = 1 AND active = 1 ORDER BY name')
      .all();
    const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();
    sendJson(res, 200, {
      mechanics: mechanics.map((m) => ({ id: m.id, name: m.name, workingDays: parseWorkingDays(m.working_days) })),
      // The widest day, so the old booking page's grid covers every open hour;
      // a shorter day comes back from /availability as busy time.
      openingTime: widestHours(toCapacitySettings(settings)).open,
      closingTime: widestHours(toCapacitySettings(settings)).close,
      openingDays: parseWorkingDays(settings.opening_days),
    });
  });

  // The customer booking page's service list (book screens 01 and 02). Public,
  // no sign-in, inside the shop's row-level security context like every portal
  // route, so it can only ever read this shop's rows. Only services the shop has
  // ticked bookable online, and prices only when the shop shows prices online
  // (docs/decisions/2026-09-04-booking-mode-and-downtime.md §7). Prices pass
  // through as stored - nothing is totalled here.
  // shopName: the booking screens' header (d1 spec).
  // screens: service, service-list
  // Piece 8: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
  route('GET', '/api/portal/:shopSlug/services', async (req, res, params, query, shop) => {
    const settings = await db.prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get();
    const showPrices = settings?.show_prices_online === 1;
    const services = await db.prepare(
      `SELECT id, name, price, minutes, kind, category_id, questions FROM workshop_services
       WHERE active = 1 AND bookable_online = 1 ORDER BY position, name`
    ).all();
    const categories = await db.prepare(
      'SELECT id, name FROM workshop_service_categories ORDER BY position, name'
    ).all();
    const toPublic = (s) => ({ id: s.id, name: s.name, price: showPrices ? s.price : null, minutes: s.minutes, questions: s.questions });
    const individual = services.filter((s) => s.kind === 'individual');
    // What each full service includes, for its card and for d2's "already part
    // of your <full service>" warning: services still in use, bookable online
    // or not (piece 8 decision 4), in the shop's order.
    const links = await db.prepare(
      `SELECT i.service_id, s.id, s.name FROM workshop_service_includes i
       JOIN workshop_services s ON s.id = i.included_service_id
       WHERE s.active = 1 AND s.kind = 'individual' ORDER BY i.service_id, i.position`
    ).all();
    const includesOf = (id) => links.filter((l) => l.service_id === id).map((l) => ({ id: l.id, name: l.name }));
    sendJson(res, 200, {
      shopName: shop.name,
      showPrices,
      full: services.filter((s) => s.kind === 'full').map((s) => ({ ...toPublic(s), includes: includesOf(s.id) })),
      categories: categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          services: individual.filter((s) => s.category_id === c.id).map(toPublic),
        }))
        .filter((c) => c.services.length > 0),
      uncategorised: individual.filter((s) => s.category_id === null).map(toPublic),
    });
  });

  // The terms a customer is agreeing to when they book: this shop's own when
  // it has set one, else the standard Wheelhouse terms. Public, no sign-in,
  // read through the shop's row-level security like every portal route, so it
  // can only ever read this shop's own setting.
  // Spec: docs/superpowers/specs/2026-09-26-book-server-11-terms-design.md
  route('GET', '/api/portal/:shopSlug/terms', async (req, res) => {
    const settings = await db.prepare('SELECT booking_terms FROM workshop_settings LIMIT 1').get();
    const standard = !settings?.booking_terms;
    sendJson(res, 200, {
      title: 'Booking terms',
      text: standard ? STANDARD_BOOKING_TERMS : settings.booking_terms,
      standard,
    });
  });

  // Public: the customer calendar. `busy` and `fullDays` keep the shape the old
  // booking page reads (public-portal/portal.js:263) - blocks, closures and a
  // shorter day come back as busy time with no reason. With `minutes`, `days`
  // adds what the new screens need: the mode per date, and per mechanic the
  // start times (timed) or whether the job fits (drop-off). Never returned: a
  // block's reason, other customers' jobs, minute totals.
  // screens: date, appointment, full
  route('GET', '/api/portal/:shopSlug/availability', async (req, res, params, query) => {
    const start = query.get('start');
    const end = query.get('end');
    if (!isRealDate(start || '') || !isRealDate(end || '')) {
      return badRequest(res, 'Valid start and end dates are required');
    }
    if (end < start) return badRequest(res, 'The end date must be on or after the start date');
    if (dayCount(start, end) > MAX_RANGE_DAYS) {
      return badRequest(res, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
    }
    let minutes = null;
    if (query.get('minutes') !== null) {
      minutes = Number(query.get('minutes'));
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
        return badRequest(res, 'minutes must be a whole number between 1 and 720');
      }
    }
    let mechanicFilter = null;
    if (query.get('mechanicId')) {
      mechanicFilter = Number(query.get('mechanicId'));
      if (!Number.isInteger(mechanicFilter)) return badRequest(res, 'mechanicId must be a whole number');
    }
    const keep = (x) => mechanicFilter === null || x.mechanicId === mechanicFilter;

    const { settings, jobs, days } = await loadCapacity(start, end);
    const busy = [];
    const fullDays = [];
    for (const day of days) {
      const view = legacyView(day, settings, jobs);
      busy.push(...view.busy);
      fullDays.push(...view.fullDays);
    }
    const body = { busy: busy.filter(keep), fullDays: fullDays.filter(keep) };
    if (minutes !== null) {
      // Nothing sooner than the shop's minimum notice, on the shop's clock (piece
      // 10). A date before today is always before the earliest moment, so it
      // offers nothing.
      const earliest = earliestBookable(settings);
      body.days = days.map((day) => ({
        date: day.date,
        mode: day.mode,
        ...(day.mode === 'dropoff'
          ? { dropoffWindow: { start: settings.dropoffWindowStart, end: settings.dropoffWindowEnd } } : {}),
        mechanics: day.mechanics.filter(keep).map((m) => (day.mode === 'timed'
          ? {
            mechanicId: m.mechanicId,
            startTimes: startTimesFor(m, minutes).filter((t) => startIsInTime(earliest, day.date, t)),
          }
          : {
            mechanicId: m.mechanicId,
            bookable: fitsDropoff(m, minutes) && dropoffIsInTime(earliest, day.date, settings.dropoffWindowEnd),
          })),
      }));
    }
    sendJson(res, 200, body);
  });

  route('GET', '/api/portal/:shopSlug/bikes', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const rows = await db
      .prepare('SELECT * FROM customer_bikes WHERE customer_id = ? AND active = 1 ORDER BY make, model')
      .all(ctx.login.customer_id);
    sendJson(res, 200, rows.map(serializeBike));
  });

  route('POST', '/api/portal/:shopSlug/bikes', async (req, res, params) => {
    const ctx = await currentCustomerSession(req);
    if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const make = (body.make || '').trim();
    const model = (body.model || '').trim();
    if (!make && !model) return badRequest(res, 'Make or model is required');
    const info = await db
      .prepare(
        `INSERT INTO customer_bikes (customer_id, make, model, colour, serial_number, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(ctx.login.customer_id, make, model, (body.colour || '').trim(), (body.serialNumber || '').trim(), nowIso());
    const row = await db.prepare('SELECT * FROM customer_bikes WHERE id = ?').get(info.lastInsertRowid);
    sendJson(res, 201, serializeBike(row));
  });
}
