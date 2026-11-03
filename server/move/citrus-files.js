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
};
const HEADING_ROWS = 20;
const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * @param {string[][]} rows a file's rows
 * @returns {{ report: string, rows: Record<string,string>[], storeName: string } | null}
 * null when it's no report we know, or has none of its rows. Only the columns
 * used are kept, and rows with nothing in them are dropped.
 */
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
    for (const row of rows.slice(headingAt + 1)) {
      const data = {};
      for (const [name, at] of wanted) {
        // A stray nothing-character is the one thing Postgres won't store.
        const v = String(row[at] ?? '').replaceAll('\u0000', '').trim();
        if (v !== '') data[name] = v;
      }
      if (Object.keys(data).length) out.push(data);
    }
    if (out.length === 0) return null;
    return { report, rows: out, storeName: out.find((d) => d.Store)?.Store ?? '' };
  }
  return null;
}
