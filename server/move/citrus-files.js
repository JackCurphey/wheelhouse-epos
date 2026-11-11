// Which Citrus Lime report a file is, from its column names, with no
// column-matching screen (Moving from Citrus Lime decision 2;
// openspec/changes/citrus-import-products, design 2). Column names are the
// reports' own (docs/superpowers/specs/2026-10-05-citrus-lime-exports.md).
const REPORTS = {
  price_list: {
    needs: ['Item Lookup Code', 'Description', 'Price', 'Qty On Hand'],
    keeps: ['Store', 'Department', 'Category', 'Supplier', 'Item Lookup Code', 'Description', 'Store Cost', 'Price', 'Tax Rate', 'Min (Reorder Point)', 'Qty On Hand', 'Active'],
  },
  barcodes: {
    needs: ['Alias', 'ILC'],
    keeps: ['Alias', 'ILC', 'Description'],
  },
  // Top Customers (openspec/changes/citrus-import-customers, design 2).
  customers: {
    needs: ['Account Number', 'First Name', 'Last Name', 'Email', 'Phone'],
    keeps: ['Account Number', 'First Name', 'Last Name', 'Address', 'Address 2', 'City', 'County', 'Postcode', 'Country', 'Email', 'Phone', 'GDPR Consent', 'GDPR Consent Date'],
  },
  // Service Items Report: the customers' bikes.
  bikes: {
    needs: ['Description', 'Serial Number', 'Customer Name', 'Email Address'],
    keeps: ['Description', 'Serial Number', 'Customer Name', 'Email Address', 'Mobile Number', 'Phone Number'],
  },
};
const HEADING_ROWS = 20;
const MAX_KEPT_CHARS = 64_000_000;
const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * @param {string[][]} rows a file's rows
 * @returns {{ report: string, rows: string[], storeName: string } | null} each
 * row as JSON. null when it's no report we know, has none of its rows, or keeps
 * too much. Only the columns used are kept, rows with nothing in them are
 * dropped, and text is made safe to store.
 */
/** The columns a report keeps, in Citrus Lime's own order (for Settings › Your data's download). */
export const keptColumns = (report) => REPORTS[report]?.keeps ?? [];

export function recognise(rows) {
  for (const [report, { needs, keeps }] of Object.entries(REPORTS)) {
    const headingAt = rows.slice(0, HEADING_ROWS).findIndex((row) => {
      const cells = row.map(norm);
      return needs.every((n) => cells.includes(norm(n)));
    });
    if (headingAt < 0) continue;
    const cells = rows[headingAt].map(norm);
    const wanted = keeps.map((name) => [name, cells.indexOf(norm(name))]).filter(([, at]) => at >= 0);
    const out = [];
    let kept = 0;
    let storeName = '';
    for (const row of rows.slice(headingAt + 1)) {
      const data = {};
      for (const [name, at] of wanted) {
        // Half a character, or a nothing-character, Postgres won't store.
        const v = String(row[at] ?? '').replaceAll('\u0000', '').toWellFormed().trim();
        if (v !== '') data[name] = v;
      }
      if (Object.keys(data).length === 0) continue;
      const json = JSON.stringify(data);
      kept += json.length;
      if (kept > MAX_KEPT_CHARS) return null;
      storeName ||= data.Store ?? '';
      out.push(json);
    }
    if (out.length === 0) return null;
    return { report, rows: out, storeName };
  }
  return null;
}
