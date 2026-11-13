// When "Close the day" shows (openspec/changes/close-the-day; cash-up
// decision 5; eod-entry). Shared by the close's own route and the float
// check, which takes a look at closing only while it shows (second review,
// 27 Oct). Runs with the shop's row-level security bound.
import { prepare } from '../db.js';
import { shopNow } from '../clock.js';
import { effectiveHours, toMinutes } from '../capacity.js';
import { currentShopTimeZone, toCapacitySettings } from '../workshop/jobs.js';

// From the shop's chosen minutes before closing, 0, 30 or 60 (set-eod-close;
// owner-setup-till-payments-eod design 3), all day when the opening hours
// say the shop is shut today, and not once the day is closed. `hours` is
// today's { open, close } or null; `minutes` is the shop's time of day.
// `before` must be given, so no caller gets the old fixed hour by accident.
export function entryFor(hours, minutes, closed, before) {
  if (![0, 30, 60].includes(before)) throw new Error('Close the day shows 0, 30 or 60 minutes before closing');
  const closesAt = hours ? hours.close : null;
  if (closed) return { show: false, closesAt };
  return { show: hours ? minutes >= toMinutes(hours.close) - before : true, closesAt };
}

/** The shop's today, its time of day, and whether "Close the day" shows now. */
export async function closeEntryNow() {
  const now = shopNow(await currentShopTimeZone());
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const shop = await prepare("SELECT close_entry_minutes FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();
  const weekday = new Date(`${now.date}T12:00:00Z`).getUTCDay();
  const closed = !!(await prepare('SELECT 1 FROM day_closes WHERE day = ? AND reopened_at IS NULL').get(now.date));
  return { day: now.date, entry: entryFor(effectiveHours(toCapacitySettings(settings), weekday), now.minutes, closed, shop.close_entry_minutes) };
}
