// The dashboard: GET /api/dashboard, today's takings, top sellers and low stock.
// Staff route: it runs under the dispatcher's /api/ branch (server.js), so a
// handler gets (req, res, params, query, afterRelease, shopId) with the
// shop's row-level security already bound, and needs a staff session. Mark's
// file. Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { prepare, dbExec } from '../db.js';
import { sendJson } from '../lib/http.js';
import { serializeProduct } from '../lib/serializers.js';
import { shopDayWindow } from '../lib/sales.js';
import { currentShopToday } from '../workshop/jobs.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

// ---------- Dashboard ----------

export function register(route) {
  route('GET', '/api/dashboard', async (req, res) => {
    // Both records, in pence (the all_sales view): a sale counts once wherever
    // it was recorded, on the day of the till's clock for a till sale.
    const today = await shopDayWindow('made_at', await currentShopToday());
    const todayAgg = await db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total_pence), 0) AS total_pence
         FROM all_sales WHERE ${today.sql}`
      )
      .get(...today.args);

    const lowStock = (await db
      .prepare(
        `SELECT * FROM products WHERE active = 1 AND low_stock_threshold > 0 AND stock_qty <= low_stock_threshold
         ORDER BY stock_qty ASC`
      )
      .all())
      .map(serializeProduct);

    const todayOld = await shopDayWindow('s.created_at', await currentShopToday());
    const todayTill = await shopDayWindow('t.till_clock_at', await currentShopToday());
    const topToday = await db
      .prepare(
        `SELECT name, SUM(qty) AS qty, SUM(revenue) AS revenue FROM (
           SELECT si.name, si.qty, si.line_total AS revenue
             FROM sale_items si JOIN sales s ON s.id = si.sale_id
            WHERE ${todayOld.sql}
           UNION ALL
           SELECT l.description, l.qty, l.line_total_pence / 100.0
             FROM till_sale_lines l JOIN till_sales t ON t.id = l.till_sale_id
            WHERE ${todayTill.sql}
         ) lines
         GROUP BY name
         ORDER BY revenue DESC
         LIMIT 5`
      )
      .all(...todayOld.args, ...todayTill.args);

    sendJson(res, 200, {
      todayCount: todayAgg.count,
      todayTotal: todayAgg.total_pence / 100,
      todayTotalPence: todayAgg.total_pence,
      lowStock,
      topToday,
    });
  });
}
