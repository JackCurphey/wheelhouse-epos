// Row-to-JSON shapes shared by more than one route area (split plan §4.1,
// WP-0.4): products (products, stock, suppliers' catalogue, booking) and
// customers' bikes (customers, booking). Moved out of server.js unchanged.

export function serializeProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    supplier: row.supplier,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    showOnline: !!row.show_online,
    description: row.description || '',
    photoUrl: row.photo_url || null,
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
