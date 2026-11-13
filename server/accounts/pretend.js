// The pretend accounts software (reports-accounts-and-reopen design 4): stands in for Xero and QuickBooks until
// Jack says yes to a real account. It makes no outside call; what it is sent is kept in Wheelhouse's own tables
// (the summaries, in a later pull request). Its accounts are the drawing's placeholder "[Xero account]", a small
// fixed list, so the choices can be made and tested without any account.
import { randomUUID } from 'node:crypto';
import { prepare } from '../db.js';
import { ConnectionLost } from './errors.js';

const NAMES = { xero: 'Xero', quickbooks: 'QuickBooks' };
const COUNT = 8;

// A test can make the pretend service answer as a real one might: ACCOUNTS_PRETEND_REFUSE=lost is a refused or
// expired connection, =down is a service that doesn't answer.
function maybeRefuse() {
  const how = process.env.ACCOUNTS_PRETEND_REFUSE;
  if (how === 'lost') throw new ConnectionLost();
  if (how === 'down') throw new Error('The service didn’t answer');
}

export const pretend = {
  name: 'pretend',
  providerName: (provider) => NAMES[provider],
  // What connecting gives back: the pretend service always accepts.
  async connect(provider) {
    if (!NAMES[provider]) throw new Error(`no such accounts software: ${provider}`);
    return { provider };
  },
  // The accounts a shop could choose, as the service lists them.
  async listAccounts(provider) {
    return Array.from({ length: COUNT }, (_, i) => ({ id: `${provider}-${i + 1}`, name: `[${NAMES[provider]} account ${i + 1}]` }));
  },
  async disconnect() {
    return { ok: true };
  },
  // Post a day's summary: kept in Wheelhouse's own table, one a day, and the id the service gives back.
  async postSummary(provider, day, summary) {
    maybeRefuse();
    const externalId = `pretend-${provider}-${randomUUID()}`;
    await prepare(
      "INSERT INTO accounts_pretend_summaries (provider, external_id, day, version, summary) VALUES (?, ?, ?::date, 1, ?::jsonb)"
    ).run(provider, externalId, day, JSON.stringify(summary));
    return { externalId };
  },
  // A corrected day: the earlier summary is replaced, so the service never holds both.
  async replaceSummary(provider, externalId, summary) {
    maybeRefuse();
    const row = await prepare(
      'UPDATE accounts_pretend_summaries SET summary = ?::jsonb, version = version + 1, updated_at = now() WHERE external_id = ? RETURNING external_id'
    ).get(JSON.stringify(summary), externalId);
    if (!row) throw new Error('The service has no such summary');
    return { externalId };
  },
};
