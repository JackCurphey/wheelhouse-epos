/**
 * Money as shown to people (Jack, 11 Nov 2026: "£184,320.00" everywhere in the app except
 * the old one): pounds and pence with the thousands comma, en-GB style. One place, so a
 * figure reads the same on every screen. Built by hand from whole pence, never by dividing
 * into a float, so a large figure stays exact.
 *
 * Typed boxes and spreadsheet files are not "shown" money: a box someone edits takes plain
 * `1234.50` (`penceInput`), and a spreadsheet keeps plain numbers so Excel reads them as numbers.
 */
const group = (whole: number) => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Pence as pounds: 123450 is "£1,234.50". Anything not whole pence, or negative, is "", never "e+" or "NaN". */
export function penceText(pence: number): string {
  if (!Number.isSafeInteger(pence) || pence < 0) return '';
  return `£${group(Math.floor(pence / 100))}.${String(pence % 100).padStart(2, '0')}`;
}

/** Pounds, as a till, a quote or a service price holds them: 1234.5 is "£1,234.50". A loss reads "−£5.00". */
export function poundsText(pounds: number): string {
  const pence = Math.round(Math.abs(pounds) * 100);
  const text = penceText(pence);
  return pounds < 0 && pence > 0 && text !== '' ? `−${text}` : text;
}

/** Pence as plain pounds and pence for a box someone types in: 123450 is "1234.50", no comma. */
export function penceInput(pence: number): string {
  return Number.isSafeInteger(pence) && pence >= 0 ? `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}` : '';
}
