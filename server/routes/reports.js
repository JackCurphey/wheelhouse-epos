// Reports (openspec/changes/reports-sales-and-takings; WP-5.3 part 1): the
// Reports page and the Sales report, read-only, for the shop's Owner only
// until roles are built (docs/decisions/2026-10-19-owner-only-settings.md).
// Every handler asks ownerOnly first, and reads through the request's shop
// (row-level security), so another shop's sales never count.
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { sendJson, ValidationError } from '../lib/http.js';
import { currentShopToday, currentShopTimeZone } from '../workshop/jobs.js';
import { prepare } from '../db.js';
import { salesReport } from '../lib/report-sales.js';
import { takingsReport } from '../lib/report-takings.js';
import { workshopReport, workshopCsv } from '../lib/report-workshop.js';
import { returningReport, returningCsv } from '../lib/report-customers.js';
import { changedReport, changedChoices, changedCsv } from '../lib/report-changed.js';
import { canSeeCosts } from '../lib/can-see-costs.js';
import { closeOn } from './close-the-day.js';
import { salesCsv, takingsCsv, dayCsv } from '../lib/report-csv.js';

const OWNER_ONLY = "Only the shop's owner can see reports";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateLine = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
};

// "North Street Cycles, Bolton": the shop's name, and its site's name when it
// has only the one (more come with the shop switcher, WP-5.2).
async function shopLine(ctx) {
  const sites = await prepare('SELECT name FROM sites ORDER BY id').all();
  return sites.length === 1 && sites[0].name ? `${ctx.shop.name}, ${sites[0].name}` : ctx.shop.name;
}

// The day the shop started on Wheelhouse, on its own clock ("The shop started on Wheelhouse on [date]", rp-sales-empty).
async function startedOn(ctx) {
  const timeZone = await currentShopTimeZone();
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ctx.shop.created_at));
}

// A spreadsheet answer: the file name says the report, the shop and the dates.
function sendCsv(res, name, csv) {
  res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` });
  res.end(csv);
}
const dates = (p) => `${p.from}-to-${p.through}`;

// A period asked for in the address, or a 400 saying what to fix.
const asked = (query) => ({ period: query.get('period') || 'this-week', from: query.get('from'), to: query.get('to') });
const returningAsked = (query) => ({ ...asked(query), period: query.get('period') || 'last-12-months', months: query.get('months') });

export function register(route) {
  // The Reports page: the date, the shop, and this week's takings so far.
  // screens: rp-home
  route('GET', '/api/reports/home', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    const today = await currentShopToday();
    const week = await salesReport({ period: 'this-week' }, today);
    sendJson(res, 200, {
      today, dateLine: dateLine(today), shopLine: await shopLine(ctx),
      strip: { heading: week.period.label, takingsPence: week.figures.takings.pence },
    });
  });

  // The Sales report for a period, compared with the period before it.
  // screens: rp-sales, rp-sales-year, rp-sales-empty, rp-pick-dates
  route('GET', '/api/reports/sales', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const today = await currentShopToday();
      const report = await salesReport(asked(query), today);
      sendJson(res, 200, { ...report, today, shopLine: await shopLine(ctx), startedOn: await startedOn(ctx) });
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });
  // Takings and cash-ups: each closed day as saved, for a period and the one before it.
  // screens: rp-takings
  route('GET', '/api/reports/takings', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const today = await currentShopToday();
      const report = await takingsReport(asked(query), today);
      sendJson(res, 200, { ...report, today, shopLine: await shopLine(ctx) });
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });

  // One closed day's end-of-day report, as saved at the close; another shop's
  // close is not found (row-level security).
  // screens: rp-day
  route('GET', '/api/reports/days/:id', async (req, res, params) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const id = /^\d{1,9}$/.test(params.id) ? Number(params.id) : null;
    const row = id === null ? null : await prepare("SELECT to_char(day, 'YYYY-MM-DD') AS day FROM day_closes WHERE id = ?").get(id);
    const close = row ? await closeOn(row.day) : null;
    if (!close) return sendJson(res, 404, { error: 'That day isn’t closed' });
    sendJson(res, 200, { close });
  });
  // Download as spreadsheet: each report's table as shown, for the period chosen.
  // screens: rp-sales
  route('GET', '/api/reports/sales.csv', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const report = await salesReport(asked(query), await currentShopToday());
      sendCsv(res, `sales-${ctx.shop.slug}-${dates(report.period)}`, salesCsv(report));
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });

  // screens: rp-takings
  route('GET', '/api/reports/takings.csv', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const report = await takingsReport(asked(query), await currentShopToday());
      sendCsv(res, `takings-${ctx.shop.slug}-${dates(report.period)}`, takingsCsv(report));
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });

  // A closed day's report, as saved. Its own path under the day, not ":id.csv",
  // which "/api/reports/days/:id" would shadow.
  // screens: rp-day
  route('GET', '/api/reports/days/:id/csv', async (req, res, params) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    const id = /^\d{1,9}$/.test(params.id) ? Number(params.id) : null;
    const row = id === null ? null : await prepare("SELECT to_char(day, 'YYYY-MM-DD') AS day FROM day_closes WHERE id = ?").get(id);
    const close = row ? await closeOn(row.day) : null;
    if (!close) return sendJson(res, 404, { error: 'That day isn’t closed' });
    sendCsv(res, `day-${ctx.shop.slug}-${close.day}`, dayCsv(close));
  });

  // Workshop: jobs booked in, finished and collected, workshop takings, quotes
  // and how full each mechanic was, for a period and the one before it.
  // screens: rp-workshop
  route('GET', '/api/reports/workshop', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const today = await currentShopToday();
      const report = await workshopReport(asked(query), today);
      sendJson(res, 200, { ...report, today, shopLine: await shopLine(ctx) });
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });

  // screens: rp-workshop
  route('GET', '/api/reports/workshop.csv', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const report = await workshopReport(asked(query), await currentShopToday());
      sendCsv(res, `workshop-${ctx.shop.slug}-${dates(report.period)}`, workshopCsv(report));
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });

  // Returning customers: new and returning customers by month, the share back
  // within 12 months, and the customers not seen for [n] months (?months=).
  // screens: rp-returning
  route('GET', '/api/reports/returning', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const today = await currentShopToday();
      const report = await returningReport(returningAsked(query), today);
      sendJson(res, 200, { ...report, today, shopLine: await shopLine(ctx) });
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });

  // screens: rp-returning
  route('GET', '/api/reports/returning.csv', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const report = await returningReport(returningAsked(query), await currentShopToday());
      sendCsv(res, `returning-${ctx.shop.slug}-${dates(report.period)}`, returningCsv(report));
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });

  // Change what's shown (Sales, and Takings and cash-ups): another measure, split
  // and limits, read from the sale lines. A combination that doesn't fit is a 400
  // with its reason; the choices route answers any selection with one that fits.
  // screens: rp-change, rp-changed
  route('GET', '/api/reports/changed', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const today = await currentShopToday();
      const report = await changedReport(query, today, { canSeeCosts: await canSeeCosts(req) });
      sendJson(res, 200, { ...report, today, shopLine: await shopLine(ctx) });
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });
  // screens: rp-change
  route('GET', '/api/reports/changed/choices', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    try {
      sendJson(res, 200, await changedChoices(query, await currentShopToday(), { canSeeCosts: await canSeeCosts(req) }));
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });
  // screens: rp-changed
  route('GET', '/api/reports/changed.csv', async (req, res, params, query) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const ctx = await currentSession(req);
    try {
      const report = await changedReport(query, await currentShopToday(), { canSeeCosts: await canSeeCosts(req) });
      sendCsv(res, `${report.fileName}-${ctx.shop.slug}-${dates(report.period)}`, changedCsv(report));
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });
}
