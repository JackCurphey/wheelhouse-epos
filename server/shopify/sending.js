// Sending products to a shop's Shopify in the background
// (openspec/changes/website-management design 7; ws-shopify-sending: "You can
// leave this page — it carries on"). Each round takes a few products off the
// link's queue in one statement, so two rounds at once never send the same
// one, sends them outside any transaction, then counts them. What couldn't be
// sent is kept as a problem, including, when Shopify stops answering, every
// product of the batch not yet sent: Try sending again sends them, and
// Wheelhouse doesn't keep asking by itself. Paused or stopped, nothing more is
// taken, and a round that ends after Switch counts nothing into the stopped link.
import { pool, prepare, runWithShop } from '../db.js';
import { shopify } from './index.js';
import { countInShopify, PROBLEM_WORDS, productsToSend } from './link.js';

const BATCH = 10;
// Longer than any batch of ten takes, so only a round no one is finishing.
const STALE_MINUTES = 5;

const problem = (product, answer) => ({
  productId: product.wheelhouseId, sku: product.sku, name: product.title, kind: answer.kind, reason: answer.reason ?? PROBLEM_WORDS[answer.kind],
});

async function finish(address, still) {
  const inShopify = await countInShopify(address);
  await prepare(
    `UPDATE shopify_link SET state = 'idle', last_sent_at = now(), product_count = ?, updated_at = now()
      WHERE state IN ('sending', 'paused') AND ${still} RETURNING shop_id`
  ).run(inShopify);
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
      if (cutOff) await finish(cutOff.address, `cardinality(to_send) = 0 AND updated_at < now() - interval '${STALE_MINUTES} minutes'`);
      return false;
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

// As bringing a Citrus Lime file across (server/move/bring-across.js): every
// shop once at the start, for anything a restart left waiting, then only a
// shop that has pressed Send or Resume.
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
} = {}) {
  let round = null;
  let stopped = false;
  let wantAll = scanAtStart && !!shopify();
  const timer = setInterval(() => {
    if (round || (!wantAll && wantedShops.size === 0)) return;
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
