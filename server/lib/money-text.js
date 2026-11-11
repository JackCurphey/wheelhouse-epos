// Money in the server's own words (receipts, emails, text messages, refusals), with the
// thousands comma, en-GB style: "£1,234.50" (Jack, 11 Nov 2026). The screens do the same in
// src/lib/money.ts. Built by hand from whole pence, so a large figure stays exact.
//
// Spreadsheet files are not "shown" money: they keep plain numbers (`penceToPounds` in
// server/lib/pence.js, "1234.50") so Excel reads them as numbers.
const group = (whole) => String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Whole pence as pounds: 123450 is "£1,234.50"; a loss reads "−£5.00". Anything else is "". */
export function penceText(pence) {
  if (!Number.isSafeInteger(pence)) return '';
  const abs = Math.abs(pence);
  return `${pence < 0 ? '−' : ''}£${group(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, '0')}`;
}

/** Pounds as a quote or a till holds them: 1234.5 is "£1,234.50". */
export const poundsText = (pounds) => penceText(Math.round(Number(pounds) * 100));

/** Whole pounds, as a spending limit is: 1500 is "£1,500". */
export const wholePoundsText = (pounds) => (pounds !== null && pounds !== '' && Number.isFinite(Number(pounds)) ? `£${group(Math.floor(Number(pounds)))}` : '');
