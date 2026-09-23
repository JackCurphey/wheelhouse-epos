/**
 * Print and message INTENT - the stub behind the seven print and message
 * screens (decision A, 20 Sep).
 *
 * P00b (printer, label stock, driver host) and P00c (message providers) are
 * outstanding, so the system genuinely does not know whether anything reached
 * a printer or a customer. This module therefore records that someone asked,
 * and nothing else: `state` is always `recorded` and `deliveredAt` is always
 * null. Both are literal types, so an edit that tries to report delivery fails
 * to typecheck, and tests/screens/intent-adapter.test.js fails if a delivery
 * state name appears in this file at all. A stub that reports success would
 * be fabricated data.
 *
 * A record is only the object handed back to the screen that asked - nothing
 * is stored. There is no print-task or message-intent endpoint yet (Phase 5),
 * and a table here would be schema work this phase does not own. A record is
 * gone after a reload, so a screen must not suggest the shop now holds a
 * lasting record - only that the request was noted and delivery is not
 * connected.
 *
 * Phase 5 replaces the bodies below; the signatures stay, so no screen changes.
 */

export type PrintKind = 'tag' | 'job-card';
export type MessageChannel = 'email' | 'sms' | 'whatsapp';

type IntentBase = { id: string; createdAt: string; state: 'recorded'; deliveredAt: null };
export type PrintIntent = IntentBase & { intent: 'print'; kind: PrintKind; jobId: number };
export type MessageIntent = IntentBase & {
  intent: 'message';
  channel: MessageChannel;
  bodyText: string;
  jobId: number;
};
export type IntentRecord = PrintIntent | MessageIntent;

// A counter, not crypto.randomUUID(): that only exists in a secure context, and
// a shop till reached over plain http on the local network is not one.
let nextId = 1;

function base(): IntentBase {
  return { id: `intent-${nextId++}`, createdAt: new Date().toISOString(), state: 'recorded', deliveredAt: null };
}

export async function recordPrintIntent(jobId: number, kind: PrintKind): Promise<IntentRecord> {
  const record: PrintIntent = { ...base(), intent: 'print', kind, jobId };
  return record;
}

export async function recordMessageIntent(
  jobId: number,
  channel: MessageChannel,
  bodyText: string,
): Promise<IntentRecord> {
  const record: MessageIntent = { ...base(), intent: 'message', channel, bodyText, jobId };
  return record;
}
