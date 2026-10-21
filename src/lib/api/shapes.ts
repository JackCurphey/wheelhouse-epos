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

/** A workshop job: serializeWorkshopJob plus the `parts` every job route adds. */
export const WORKSHOP_JOB: Shape = {
  id: N, title: S, reference: S, version: N,
  customerId: NN, customerName: SN, bikeId: NN, bikeLabel: SN, bikeColour: SN,
  mechanicId: NN, mechanicName: SN,
  jobDate: S, startTime: SN, endTime: SN,
  status: S, bookingState: S, custodyState: S, workState: S, newOnline: ['boolean'],
  notes: SN, questionAnswers: ON, customerDescription: SN, customerBikeNote: SN,
  requested: ON, offer: ON,
  cancelledBy: SN, cancelledAt: SN, cancellationSeenAt: SN, changeDeclinedAt: SN,
  orderId: NN, orderStatus: SN, orderTotal: NN,
  quote: ON,
  signedOffBy: NN, signedOffByName: SN, signedOffAt: SN,
  parts: ['array'],
  createdAt: S, updatedAt: S,
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
