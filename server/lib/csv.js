// Spreadsheet (CSV) cells, for the downloads a shop or a customer takes away
// (stock take's counts; a customer's copy of their data).
export const csvCell = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
// A name or code a spreadsheet would read as a formula is written as text
// (review, 28 Oct): a ' before =, +, -, @, a tab or a return. Numbers stay numbers.
export const textCell = (v) => csvCell(/^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : v);
// Every cell as text, a header row first, each row ending in a return.
export const csvOf = (rows) => rows.map((r) => `${r.map((v) => textCell(v ?? '')).join(',')}\r\n`).join('');
