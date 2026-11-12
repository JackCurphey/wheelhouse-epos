// Sending products to a shop's Shopify in the background
// (openspec/changes/website-management design 7; ws-shopify-sending: "You can
// leave this page — it carries on"). Each round takes a few products off the
// link's queue in one statement, so two rounds at once never send the same
// one, sends them outside any transaction, then counts them. What couldn't be
// sent is kept as a problem, including, when Shopify stops answering, every
// product of the batch not yet sent: Try sending again sends them, and
// Wheelhouse doesn't keep asking by itself. Paused or stopped, nothing more is
// taken, and a round that ends after Switch counts nothing into the stopped link.
//
// Between sends, what changed in Wheelhouse goes as it changes (Jack's answer
// to Q2, 12 Nov evening; ws-shopify-on "sent as you change them in
// Wheelhouse"): the database queues each changed product (migration 150) and
// liveRound sends a few at a time while the link is idle, then takes them off
// the queue unless they changed again meanwhile. Each product's problem is
// replaced by how this send went; Shopify not answering is a problem for Try
// sending again, as above, and isn't asked again by itself.
import { pool, prepare, runWithShop } from '../db.js';
import { shopify } from './index.js';
import { compare, countInShopify, noPriceProblem, PROBLEM_WORDS, productsToSend } from './link.js';

const BATCH = 10;
// Longer than any batch of ten takes, so only a round no one is finishing.
const STALE_MINUTES = 5;

const problem = (product, answer) => ({
  productId: product.wheelhouseId, sku: product.sku, name: product.title, kind: answer.kind, reason: answer.reason ?? PROBLEM_WORDS[answer.kind],
});

// When each shop was last caught up with Shopify (in memory, so once after
// each restart).
const caughtUp = new Map();

async function finish(address, still) {
  const inShopify = await countInShopify(address);
  const done = await prepare(
    `UPDATE shopify_link SET state = 'idle', last_sent_at = now(), product_count = ?, updated_at = now()
      WHERE state IN ('sending', 'paused') AND ${still} RETURNING shop_id`
  ).get(inShopify);
  // A full Send compared everything with Shopify, so it counts as the day's catch-up.
  if (done) caughtUp.set(done.shop_id, Date.now());
}

/** One batch for one shop; false when there was nothing to send. */
export async function sendRound(shopId) {
  const provider = shopify();
  if (!provider) return false;
  return runWithShop(shopId, async () => {
    const claimed = await prepare(
      `WITH old AS (SELECT shop_id, address, to_send[1:${BATCH}] AS batch FROM shopify_link
                     WHERE provider = ? AND state = 'sending' AND cardinality(to_send) > 0 FOR UPDATE)
       UPDATE shopify_link l SET to_send = l.to_send[${BATCH + 1}:], updated_at = now()
         FROM old WHERE l.shop_id = old.shop_id RETURNING old.address, old.batch`
    ).get(provider.name);
    if (!claimed) {
      // A batch a restart took off the queue and never counted: the send is
      // finished, and what wasn't sent shows in the check again.
      const cutOff = await prepare(
        `SELECT address FROM shopify_link WHERE provider = ? AND state = 'sending' AND cardinality(to_send) = 0
            AND updated_at < now() - interval '${STALE_MINUTES} minutes'`
      ).get(provider.name);
      if (cutOff) {
        await finish(cutOff.address, `cardinality(to_send) = 0 AND updated_at < now() - interval '${STALE_MINUTES} minutes'`);
        return false;
      }
      return liveRound(provider);
    }
    const problems = [];
    const products = await productsToSend(claimed.batch);
    for (const [i, product] of products.entries()) {
      let answer;
      try {
        answer = await provider.send(claimed.address, product);
      } catch (err) {
        console.error('Shopify: no answer while sending', err.code ?? err.name);
        problems.push(...products.slice(i).map((p) => problem(p, { kind: 'no_answer' })));
        break;
      }
      if (!answer.ok) problems.push(problem(product, answer));
    }
    // A product taken offline meanwhile isn't sent, but is counted as done.
    const counted = await prepare(
      `UPDATE shopify_link SET sent_count = sent_count + ?, problems = problems || ?::jsonb, updated_at = now()
        WHERE state IN ('sending', 'paused') RETURNING state, cardinality(to_send) AS waiting`
    ).get(claimed.batch.length, JSON.stringify(problems));
    // Paused during the last batch: nothing is left to pause, so it finishes too.
    if (counted && Number(counted.waiting) === 0) await finish(claimed.address, 'cardinality(to_send) = 0');
    return true;
  });
}

// Once a day, anything that differs from Shopify is queued as well: a change
// the queue missed (a script with no shop set, a failed queue warning, or a
// change made while a product was with Shopify in a way the queue can't see)
// can't leave Shopify's stock wrong for good.
async function catchUp(provider, link) {
  const every = Number(process.env.WH_SHOPIFY_CATCH_UP_MS ?? 24 * 60 * 60 * 1000);
  if (Date.now() - (caughtUp.get(link.shop_id) ?? -Infinity) < every) return;
  caughtUp.set(link.shop_id, Date.now());
  try {
    const { changing } = compare(await productsToSend(), await provider.listProducts(link.address));
    await prepare('INSERT INTO shopify_changed (product_id) SELECT unnest(?::int[]) ON CONFLICT DO NOTHING RETURNING product_id')
      .run(changing.map((p) => p.wheelhouseId));
  } catch (err) {
    console.error('Shopify: the daily check couldn’t compare with Shopify', err.code ?? err.name);
  }
}

/** What changed in Wheelhouse, a batch at a time, while nothing else is sending. */
async function liveRound(provider) {
  // Only once Send has been pressed: before that the Owner hasn't seen what will change.
  const link = await prepare(
    "SELECT shop_id, address FROM shopify_link WHERE provider = ? AND state = 'idle' AND last_sent_at IS NOT NULL"
  ).get(provider.name);
  if (!link) return false;
  await catchUp(provider, link);
  const taken = await prepare(`SELECT product_id, changed_at::text AS changed_at FROM shopify_changed ORDER BY changed_at, product_id LIMIT ${BATCH}`).all();
  if (!taken.length) return false;
  const ids = taken.map((r) => r.product_id);
  const products = await productsToSend(ids);
  const problems = [];
  let sent = 0;
  let added = 0;
  let silent = false;
  for (const [i, product] of products.entries()) {
    if (product.pricePence <= 0) { problems.push(noPriceProblem(product)); continue; }
    let answer;
    try {
      answer = await provider.send(link.address, product);
    } catch (err) {
      console.error('Shopify: no answer while sending a change', err.code ?? err.name);
      problems.push(...products.slice(i).map((p) => problem(p, { kind: 'no_answer' })));
      silent = true;
      break;
    }
    if (!answer.ok) problems.push(problem(product, answer));
    else { sent += 1; if (answer.added) added += 1; }
  }
  // Off the queue unless changed again while with Shopify (changed_at moved on;
  // read as text so the microseconds a JavaScript date drops still match).
  // One row a statement, in product order, so this never holds two queue rows
  // at once and can't deadlock with a sale queueing several products.
  for (const row of [...taken].sort((a, b) => a.product_id - b.product_id)) {
    await prepare('DELETE FROM shopify_changed WHERE product_id = ? AND changed_at = ?::timestamptz').run(row.product_id, row.changed_at);
  }
  await prepare(
    `UPDATE shopify_link SET problems = COALESCE((SELECT jsonb_agg(p ORDER BY n) FROM jsonb_array_elements(problems) WITH ORDINALITY e(p, n)
                                                   WHERE (p->>'productId')::int <> ALL(?::int[])), '[]'::jsonb) || ?::jsonb,
            last_sent_at = CASE WHEN ? THEN now() ELSE last_sent_at END, product_count = product_count + ?, updated_at = now()
      WHERE provider = ? AND address = ? AND state <> 'stopped' RETURNING shop_id`
  ).run(ids, JSON.stringify(problems), sent > 0, added, provider.name, link.address);
  // Shopify silent: the rest of the queue waits for the next round.
  return !silent;
}

// As bringing a Citrus Lime file across (server/move/bring-across.js): every
// shop once at the start, for anything a restart left waiting, then only a
// shop that has pressed Send or Resume, and every shop again each LIVE_MS for
// what changed in Wheelhouse.
const wantedShops = new Set();
export function wakeShopifySending(shopId) { wantedShops.add(shopId); }

async function sendingRound(stopped, only) {
  // Outside any one shop, as bring-across.js lists them.
  const shops = only ?? (await pool.query('SELECT id FROM shops ORDER BY id')).rows.map((s) => s.id);
  for (const shopId of shops) {
    if (stopped()) break;
    try {
      while (!stopped() && await sendRound(shopId));
    } catch (err) {
      wantedShops.add(shopId);
      console.error(`Shopify: sending failed for shop ${shopId} this round`, err.code ?? err.name);
    }
  }
}

/** Starts the timer; returns stop(), which waits for a round in flight. */
export function startShopifySending(intervalMs = Number(process.env.WH_SHOPIFY_TICK_MS ?? 2000), {
  scanAtStart = process.env.WH_SHOPIFY_SCAN_AT_START !== 'off',
  liveMs = Number(process.env.WH_SHOPIFY_LIVE_MS ?? 30000),
} = {}) {
  let round = null;
  let stopped = false;
  let wantAll = scanAtStart && !!shopify();
  let lookedAt = Date.now();
  const timer = setInterval(() => {
    if (shopify() && Date.now() - lookedAt >= liveMs) wantAll = true;
    if (round || (!wantAll && wantedShops.size === 0)) return;
    if (wantAll) lookedAt = Date.now();
    const only = wantAll ? null : [...wantedShops];
    wantAll = false;
    wantedShops.clear();
    round = sendingRound(() => stopped, only)
      .catch((err) => console.error('Shopify: sending failed this round', err.code ?? err.name))
      .finally(() => { round = null; });
  }, intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
    return round ?? Promise.resolve();
  };
}
