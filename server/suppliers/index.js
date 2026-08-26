// Adapter registry + sync entry point. Every adapter (mock or real) exports
// one function with the shape:
//   async function fetchItems(config) -> [{ supplierSku, barcode, name, price, stockQty }, ...]
// `config` is the supplier row's `config` JSONB column (already parsed into
// a plain object by `pg`). A real distributor adapter would read
// config.apiKey/config.endpoint and call their API instead of reading a
// file; runSync doesn't care which - adding one later is a new file plus
// one registry line here, nothing else changes.
import { fetchItems as mockCsvFetchItems } from './mock-csv-adapter.js';

const ADAPTERS = {
  mock_csv: mockCsvFetchItems,
};

export async function runSync(db, nowIso, supplier) {
  const adapter = ADAPTERS[supplier.adapter_type];
  if (!adapter) throw new Error(`Unknown adapter_type "${supplier.adapter_type}"`);
  const items = await adapter(supplier.config);

  let inserted = 0;
  let updated = 0;
  for (const item of items) {
    // .get() (not .run()) since this upsert's own RETURNING needs the extra
    // `inserted` column - db.js's auto-appended RETURNING only kicks in when
    // the SQL doesn't already have one, so this explicit clause isn't
    // duplicated.
    const result = await db
      .prepare(
        `INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, barcode, name, price, stock_qty)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (shop_id, supplier_id, supplier_sku) DO UPDATE SET
           price = EXCLUDED.price, stock_qty = EXCLUDED.stock_qty, name = EXCLUDED.name,
           barcode = EXCLUDED.barcode, last_seen_at = now(), updated_at = now()
         RETURNING id, (xmax = 0) AS inserted`
      )
      .get(supplier.id, item.supplierSku, item.barcode, item.name, item.price, item.stockQty);
    if (result.inserted) inserted++;
    else updated++;
  }

  await db.prepare('UPDATE suppliers SET last_synced_at = ?, updated_at = ? WHERE id = ?').run(nowIso, nowIso, supplier.id);
  return { itemCount: items.length, inserted, updated };
}
