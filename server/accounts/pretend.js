// The pretend accounts software (reports-accounts-and-reopen design 4): stands in for Xero and QuickBooks until
// Jack says yes to a real account. It makes no outside call; what it is sent is kept in Wheelhouse's own tables
// (the summaries, in a later pull request). Its accounts are the drawing's placeholder "[Xero account]", a small
// fixed list, so the choices can be made and tested without any account.
const NAMES = { xero: 'Xero', quickbooks: 'QuickBooks' };
const COUNT = 8;

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
};
