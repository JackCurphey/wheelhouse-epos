// Mock adapter standing in for a real distributor feed until Madison's
// actual API/EDI details are available (see server/suppliers/index.js for
// the shared adapter contract every future adapter, including a real
// Madison one, implements). Reads a bundled sample file rather than
// fetching anything over the network. No CSV-parsing dependency added -
// this file is fully controlled and has no embedded commas/quotes to worry
// about, so a plain split() is enough (package.json's only dependency is
// `pg` - keep it that way for a fixture this simple).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sample-data', 'madison-mock.csv');

export async function fetchItems(_config) {
  const text = await readFile(SAMPLE_FILE, 'utf8');
  const [header, ...lines] = text.trim().split('\n');
  const cols = header.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    const row = Object.fromEntries(cols.map((c, i) => [c.trim(), (cells[i] || '').trim()]));
    return {
      supplierSku: row.supplierSku,
      barcode: row.barcode || null,
      name: row.name,
      price: parseFloat(row.price) || 0,
      stockQty: parseInt(row.stockQty, 10) || 0,
    };
  });
}
