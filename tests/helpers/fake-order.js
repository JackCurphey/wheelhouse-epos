// A fake order (or quote) and its lines with every field the server sends
// (src/lib/api/shapes.ts, ORDER and ORDER_LINE), checked as it is made, as
// fake-job.js does for jobs. Unset fields are empty; nothing here is example
// data. Needs `npm run pretest`.
import { ORDER, ORDER_LINE, shapeProblems } from '../../.test-build/lib/api/shapes.js';

export function fakeOrderLine(over = {}) {
  return {
    id: 1, productId: null, name: '', sku: null, unitPrice: 0, qty: 1, lineTotal: 0, lineType: 'product', serviceId: null, minutes: null, ...over,
  };
}

export function fakeOrder(over = {}) {
  const order = {
    id: 1, kind: 'order', status: 'open', title: '',
    customerId: null, customerName: null, cashierId: null, cashierName: null,
    subtotal: 0, discount: 0, total: 0, note: null, convertedSaleId: null, workshopJobId: null,
    items: [], createdAt: '', updatedAt: '', ...over,
  };
  // Each line states only what its test uses; the rest is filled in, then checked.
  order.items = order.items.map((line) => fakeOrderLine(line));
  const problems = [...shapeProblems(ORDER, order), ...order.items.flatMap((line) => shapeProblems(ORDER_LINE, line))];
  if (problems.length) throw new Error(`Fake order ${order.id} isn't the shape the server sends: ${problems.join('; ')}`);
  return order;
}
