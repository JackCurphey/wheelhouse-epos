// A booking's deposit, worked out from the price shown when booking (Jack,
// 24 Oct, docs/decisions/2026-10-24-morning-questions.md answer 1;
// openspec/changes/deposit-settings design 4). Pure, in pence.

/**
 * Pounds typed into a setting (a fixed deposit, the unknown-price deposit),
 * to pence. Service prices are read in pence already (price_pence, step A′).
 */
export function poundsToPence(pounds) {
  if (pounds === null || pounds === undefined || pounds === '') return null;
  return Math.round(Number(pounds) * 100);
}

/**
 * `settings` as the workshop settings route serialises them; `prices` each
 * booked service's shown price in pence ("from" prices as they stand), or
 * null when not known. Null when no deposit is taken.
 */
export function depositPence(settings, prices) {
  if (!settings.depositOn || !settings.paymentsConnected) return null;
  if (prices.length === 0 || prices.some((p) => p === null || p === undefined)) return settings.depositUnknownPence ?? null;
  const total = prices.reduce((sum, p) => sum + p, 0);
  if (total <= 0) return null;
  // Whole pence times a whole percentage: exact in integers, then half up.
  // An amount not filled in yet takes nothing (decided-while-building, deposits 2).
  const wanted = settings.depositKind === 'fixed'
    ? settings.depositFixedPence
    : settings.depositPercent ? Math.floor((total * settings.depositPercent + 50) / 100) : null;
  return wanted ? Math.min(wanted, total) : null;
}
