// Emailing a sale's receipt, the email side (openspec/changes/receipt-email;
// cp-receipt-address; Jack, 23 Oct, answer 3: the till's button after #404).
// The address is for this receipt only: nothing is saved to a customer
// (leftover screens review 3). A file of its own, so #404's sales files stay
// as they are.
import { EMAIL_RE } from '../auth.js';
import { currentSession } from '../lib/session.js';
import { prepare } from '../db.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import { sendEmailTo } from '../messaging/engine.js';
import { receiptEmail } from '../messaging/receipt-email.js';

const BAD_ADDRESS = 'That doesn’t look like an email address — check it';
// So the shop's sending can't be used to mail any address over and over (review).
const PER_SALE_PER_HOUR = 5;

export function register(route) {
  // screens: till (Paid › Email, after #404)
  route('POST', '/api/sales/:id/email-receipt', async (req, res, params, query, afterRelease, shopId) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
    const body = await readJsonBody(req);
    const to = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!to || to.length > 254 || !EMAIL_RE.test(to)) return sendJson(res, 400, { error: BAD_ADDRESS, code: 'bad_address' });
    const id = Number(params.id);
    const receipt = Number.isInteger(id) && id > 0 && id <= 2_147_483_647 ? await receiptEmail(id, shopId) : null;
    if (!receipt) return sendJson(res, 404, { error: 'Sale not found' });
    const { n } = await prepare("SELECT count(*)::int AS n FROM customer_messages WHERE sale_id = ? AND template_key = 'receipt' AND created_at > now() - interval '1 hour'").get(id);
    if (n >= PER_SALE_PER_HOUR) return sendJson(res, 429, { error: 'This receipt has been sent five times in the last hour. Try again later.', code: 'too_many' });
    const messageId = await sendEmailTo({ to, subject: receipt.subject, body: receipt.body, saleId: id, customerId: receipt.customerId, loginId: ctx.login.id });
    sendJson(res, 200, { id: messageId, to });
  });
}
