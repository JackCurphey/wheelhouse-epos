// Row-to-JSON shapes shared by more than one route area (split plan §4.1,
// WP-0.4): products (products, stock, suppliers' catalogue, booking) and
// customers' bikes (customers, booking). Moved out of server.js unchanged.

// `costs`: canSeeCosts(req), the one check (openspec/changes/product-costs-hidden).
// Without it the cost is null, which nothing stored can be (the column is NOT
// NULL, no cost recorded being 0), so a screen can tell it wasn't told.
import { isBike } from './bikes.js';

// `kinds` is bikeKinds(), the business's bike categories.
export function serializeProduct(row, costs = false, kinds = new Map()) {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    // A size or colour of a product with sizes (openspec/changes/sizes-and-colours); none, none, none otherwise.
    groupId: row.group_id ?? null,
    size: row.size ?? null,
    colour: row.colour ?? null,
    price: row.price,
    cost: costs ? row.cost : null,
    // Whole pence (openspec/changes/products-in-pence). The pounds above stay for
    // the old app, the till's screen and purchase orders until those move.
    pricePence: row.price_pence,
    costPence: costs ? row.cost_pence : null,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    supplier: row.supplier,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    showOnline: !!row.show_online,
    description: row.description || '',
    photoUrl: row.photo_url || null,
    // The product's VAT rate in basis points (2000 = 20%), for its margin
    // before VAT on Stock (openspec/changes/stock-list).
    vatRateBp: row.vat_rate_bp ?? null,
    // Asked for its frame number when it's booked in (openspec/changes/frame-numbers, design 1).
    isBike: isBike(row.category, kinds),
  };
}

export function serializeBike(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    make: row.make,
    model: row.model,
    colour: row.colour,
    serialNumber: row.serial_number,
    notes: row.notes,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
