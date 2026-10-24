/**
 * The replies the screens read, written down once as something a test can
 * check (Mark's working agreement, pull request 349, task 2.4; review issue
 * 354 item 3). types.ts says the same thing to the compiler, but types vanish
 * at run time, so a screen test's fake reply could drift from the server's
 * real one and both would still pass. Here, tests/reply-shapes.test.js checks
 * the server's real replies against each shape, and the screen tests check
 * their fake replies against the same shape.
 *
 * Each field lists the types it may have: 'null' when it can be empty, and
 * 'undefined' when some replies leave it out.
 */

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined';
export type Shape = Record<string, FieldType[]>;

const S: FieldType[] = ['string'];
const N: FieldType[] = ['number'];
const SN: FieldType[] = ['string', 'null'];
const NN: FieldType[] = ['number', 'null'];
const ON: FieldType[] = ['object', 'null'];

/** One day of a job (serializePart): a part with no time has '' for its times. */
export const JOB_PART: Shape = {
  id: N, position: N, date: S, startTime: S, endTime: S, mechanicId: NN, mechanicName: SN,
};

const JOB_FIELDS: Shape = {
  // Null only on jobs made before migration 016 gave every job a number. types.ts
  // still says text: no shop on the new app has such a job (decided-while-building, 21 Oct).
  id: N, title: S, reference: SN, version: N,
  customerId: NN, customerName: SN, bikeId: NN, bikeLabel: SN, bikeColour: SN,
  mechanicId: NN, mechanicName: SN,
  jobDate: S, startTime: SN, endTime: SN,
  // The job's planned length: given, its times', or an online booking's services'; null when none.
  plannedMinutes: NN,
  spendLimit: NN,
  // Where a bike in the shop is kept (storage slots); null when none.
  storageSlotId: NN, storageSlotName: SN,
  // The deposit and Didn't come (deposit-diary-server).
  deposit: ON, noShowAt: SN,
  status: S, bookingState: S, custodyState: S, workState: S, newOnline: ['boolean'],
  // A list: each answer to the services' questions (an online booking's, even
  // when there were none), or null for a staff job.
  notes: SN, questionAnswers: ['array', 'null'], customerDescription: SN, customerBikeNote: SN,
  requested: ON, offer: ON,
  cancelledBy: SN, cancelledAt: SN, cancellationSeenAt: SN, changeDeclinedAt: SN,
  orderId: NN, orderStatus: SN, orderTotal: NN,
  quote: ON,
  signedOffBy: NN, signedOffByName: SN, signedOffAt: SN,
  createdAt: S, updatedAt: S,
};

/** A job as read: the list, one job, a new job, and the day routes, which add
 * the job's days (`parts`, each a JOB_PART). */
export const WORKSHOP_JOB: Shape = { ...JOB_FIELDS, parts: ['array'] };

/** A job after an edit or an action (book in, collect, accept, offer...): no
 * days, and the message it queued when there was one. */
export const WORKSHOP_JOB_CHANGED: Shape = {
  ...JOB_FIELDS, readyMessage: ['object', 'undefined'], bookingMessage: ['object', 'undefined'],
};

function typeOf(value: unknown): FieldType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as FieldType;
}

/** What's wrong with `value` against `shape`, in plain words; empty when it fits. */
export function shapeProblems(shape: Shape, value: Record<string, unknown>): string[] {
  const problems: string[] = [];
  for (const [field, allowed] of Object.entries(shape)) {
    const type = typeOf(value[field]);
    if (type === 'undefined' && !allowed.includes('undefined')) problems.push(`${field}: missing`);
    else if (type !== 'undefined' && !allowed.includes(type)) problems.push(`${field}: ${type}, wanted ${allowed.join(' or ')}`);
  }
  for (const field of Object.keys(value)) {
    if (!(field in shape)) problems.push(`${field}: not in the shape`);
  }
  return problems;
}

/** One line of an order or quote (serializeSaleDocument's items). */
export const ORDER_LINE: Shape = {
  id: N, productId: NN, name: S, sku: SN, unitPrice: N, qty: N, lineTotal: N, lineType: S, serviceId: NN, minutes: NN,
};

/** An order or quote with its lines (GET /api/sale-documents/:id): what the
 * till reads to pay a job's order. Money is in pounds until sales in pence. */
export const ORDER: Shape = {
  id: N, kind: S, status: S, title: S,
  customerId: NN, customerName: SN, cashierId: NN, cashierName: SN,
  subtotal: N, discount: N, total: N, note: SN,
  convertedSaleId: NN, workshopJobId: NN,
  items: ['array'],
  createdAt: S, updatedAt: S,
};
