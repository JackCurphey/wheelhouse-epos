// The dashboard: GET /api/dashboard, today's takings, open jobs and low stock.
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
    const today = await shopDayWindow('created_at', await currentShopToday());
    const todayAgg = await db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
         FROM sales WHERE ${today.sql}`
      )
      .get(...today.args);

    const lowStock = (await db
      .prepare(
        `SELECT * FROM products WHERE active = 1 AND low_stock_threshold > 0 AND stock_qty <= low_stock_threshold
         ORDER BY stock_qty ASC`
      )
      .all())
      .map(serializeProduct);

    const todayItems = await shopDayWindow('s.created_at', await currentShopToday());
    const topToday = await db
      .prepare(
        `SELECT si.name, SUM(si.qty) AS qty, SUM(si.line_total) AS revenue
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE ${todayItems.sql}
         GROUP BY si.name
         ORDER BY revenue DESC
         LIMIT 5`
      )
      .all(...todayItems.args);

    sendJson(res, 200, {
      todayCount: todayAgg.count,
      todayTotal: todayAgg.total,
      lowStock,
      topToday,
    });
  });
}
