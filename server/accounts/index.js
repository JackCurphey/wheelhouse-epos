// The accounts software adapter (reports-accounts-and-reopen design 4): what the rest of the server calls to
// connect a shop's Xero or QuickBooks, list the accounts it could choose, and (in a later pull request) post a
// day's summary and replace it when a reopened day closes again. Until Jack says yes to a real account the only
// provider is the pretend one, which makes no outside call; a real provider is a new file behind the same calls.
import { pretend } from './pretend.js';

export const PROVIDERS = [{ id: 'xero', name: 'Xero' }, { id: 'quickbooks', name: 'QuickBooks' }];
export const isProvider = (id) => PROVIDERS.some((p) => p.id === id);
export const providerName = (id) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

export function accounts() {
  return pretend;
}
