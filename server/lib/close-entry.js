// When "Close the day" shows (openspec/changes/close-the-day; cash-up
// decision 5; eod-entry). Shared by the close's own route and the float
// check, which takes a look at closing only while it shows (second review,
// 27 Oct). Runs with the shop's row-level security bound.
import { prepare } from '../db.js';
import { shopNow } from '../clock.js';
import { effectiveHours, toMinutes } from '../capacity.js';
import { currentShopTimeZone, toCapacitySettings } from '../workshop/jobs.js';

// From an hour before closing (set-eod-close's drawn "1 hour before", until
// that setting is built), all day when the opening hours say the shop is
// shut today, and not once the day is closed. `hours` is today's
// { open, close } or null; `minutes` is the shop's time of day.
export function entryFor(hours, minutes, closed) {
  const closesAt = hours ? hours.close : null;
  if (closed) return { show: false, closesAt };
  return { show: hours ? minutes >= toMinutes(hours.close) - 60 : true, closesAt };
}

/** The shop's today, its time of day, and whether "Close the day" shows now. */
export async function closeEntryNow() {
  const now = shopNow(await currentShopTimeZone());
  const settings = await prepare('SELECT * FROM workshop_settings LIMIT 1').get();
  const weekday = new Date(`${now.date}T12:00:00Z`).getUTCDay();
  const closed = !!(await prepare('SELECT 1 FROM day_closes WHERE day = ?').get(now.date));
  return { day: now.date, entry: entryFor(effectiveHours(toCapacitySettings(settings), weekday), now.minutes, closed) };
}
