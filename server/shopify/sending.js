// Sending products to a shop's Shopify in the background
// (openspec/changes/website-management design 7; ws-shopify-sending: "You can
// leave this page — it carries on"). Each round takes a few products off the
// link's queue in one statement, so two rounds at once never send the same
// one, sends them outside any transaction, then counts them and keeps what
// couldn't be sent. Paused or stopped, nothing more is taken.
import { prepare, runWithShop } from '../db.js';
import { shopify } from './index.js';
import { countInShopify, PROBLEM_WORDS, productsToSend } from './link.js';

const BATCH = 10;

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
    if (!claimed) return false;
    const problems = [];
    try {
      // A product taken offline meanwhile isn't sent, but is counted as done.
      for (const product of await productsToSend(claimed.batch)) {
        const answer = await provider.send(claimed.address, product);
        if (!answer.ok) {
          problems.push({ productId: product.wheelhouseId, sku: product.sku, name: product.title, kind: answer.kind, reason: answer.reason ?? PROBLEM_WORDS[answer.kind] });
        }
      }
    } catch (err) {
      // Shopify didn't answer: the batch goes back to the front of the queue for the next round.
      await prepare('UPDATE shopify_link SET to_send = ?::int[] || to_send, updated_at = now() RETURNING shop_id').run(claimed.batch);
      throw err;
    }
    const counted = await prepare(
      `UPDATE shopify_link SET sent_count = sent_count + ?, problems = problems || ?::jsonb, updated_at = now()
        RETURNING state, sent_count, total, cardinality(to_send) AS waiting`
    ).get(claimed.batch.length, JSON.stringify(problems));
    if (counted.state === 'sending' && Number(counted.waiting) === 0 && counted.sent_count >= counted.total) {
      const inShopify = await countInShopify(claimed.address);
      await prepare(
        `UPDATE shopify_link SET state = 'idle', last_sent_at = now(), product_count = ?, updated_at = now()
          WHERE state = 'sending' AND cardinality(to_send) = 0 AND sent_count >= total RETURNING shop_id`
      ).run(inShopify);
    }
    return true;
  });
}

// As bringing a Citrus Lime file across (server/move/bring-across.js): every
// shop once at the start, for anything a restart left waiting, then only a
// shop that has pressed Send or Resume.
const wantedShops = new Set();
export function wakeShopifySending(shopId) { wantedShops.add(shopId); }

async function sendingRound(stopped, only) {
  const shops = only ?? (await prepare('SELECT id FROM shops ORDER BY id').all()).map((s) => s.id);
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
