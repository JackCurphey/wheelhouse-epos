// Reports (openspec/changes/reports-sales-and-takings; WP-5.3 part 1): the
// Reports page and the Sales report, read-only, for the shop's Owner only
// until roles are built (docs/decisions/2026-10-19-owner-only-settings.md).
// Every handler asks ownerOnly first, and reads through the request's shop
// (row-level security), so another shop's sales never count.
import { currentSession } from '../lib/session.js';
import { ownerOnly } from '../lib/owner-only.js';
import { sendJson, ValidationError } from '../lib/http.js';
import { currentShopToday } from '../workshop/jobs.js';
import { prepare } from '../db.js';
import { salesReport } from '../lib/report-sales.js';

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

// A period asked for in the address, or a 400 saying what to fix.
const asked = (query) => ({ period: query.get('period') || 'this-week', from: query.get('from'), to: query.get('to') });

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
      sendJson(res, 200, { ...report, shopLine: await shopLine(ctx) });
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
      throw err;
    }
  });
}

