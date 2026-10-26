// A fake order (or quote) and its lines with every field the server sends
// (src/lib/api/shapes.ts, ORDER and ORDER_LINE), checked as it is made, as
// fake-job.js does for jobs. Unset fields are empty; nothing here is example
// data. Needs `npm run pretest`.
import { ORDER, ORDER_LINE, shapeProblems } from '../../.test-build/lib/api/shapes.js';

export function fakeOrderLine(over = {}) {
  const line = {
    id: 1, productId: null, name: '', sku: null, unitPrice: 0, qty: 1, lineTotal: 0, lineType: 'product', serviceId: null, minutes: null, vatRateBp: null, done: false, note: null, ...over,
  };
  // The server sends each amount in pence beside the pounds (sales in pence,
  // step A); a test that sets the pounds gets the same amount in pence.
  line.unitPricePence ??= Math.round(line.unitPrice * 100);
  line.lineTotalPence ??= Math.round(line.lineTotal * 100);
  return line;
}

export function fakeOrder(over = {}) {
  const order = {
    id: 1, kind: 'order', status: 'open', title: '',
    customerId: null, customerName: null, cashierId: null, cashierName: null,
    subtotal: 0, discount: 0, total: 0, note: null, convertedSaleId: null, workshopJobId: null,
    items: [], createdAt: '', updatedAt: '', ...over,
  };
  order.subtotalPence ??= Math.round(order.subtotal * 100);
  order.discountPence ??= Math.round(order.discount * 100);
  order.totalPence ??= Math.round(order.total * 100);
  order.paidPence ??= 0;
  // Each line states only what its test uses; the rest is filled in, then checked.
  order.items = order.items.map((line) => fakeOrderLine(line));
  const problems = [...shapeProblems(ORDER, order), ...order.items.flatMap((line) => shapeProblems(ORDER_LINE, line))];
  if (problems.length) throw new Error(`Fake order ${order.id} isn't the shape the server sends: ${problems.join('; ')}`);
  return order;
}
