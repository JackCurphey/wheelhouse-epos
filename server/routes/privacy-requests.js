// The shop's privacy requests (openspec/changes/delete-account, design 4;
// customer service decision 9; Jack's 30 Oct answer 3): the dated list, and
// deleting someone's details, the Owner only until roles are built (answer
// 3.7). The open count is for the link on Customers.
import { badRequest, notFound, readJsonBody, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { prepare, dbExec } from '../db.js';
import { currentSession } from '../lib/session.js';
import { currentMoment } from '../clock.js';
import { zipFiles } from '../lib/zip.js';
import { copyEmail, dataCopyFiles, shopNotesFile } from '../customer-data-copy.js';
import { sendEmailTo } from '../messaging/engine.js';
import { deleteCustomerDetails, listRequests, logRequest, openCount, removeFiles, shopZone } from '../privacy-requests.js';
import { repairsAndPurchases } from './portal.js';

const OWNER_ONLY = 'Only the shop’s owner can deal with privacy requests';
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'customer';

/**
 * Send the copy (finish-customers design 7; cs-privacy): the account's copy with the shop's
 * notes added, held and marked done in one step, so it's sent once. Returns the files and
 * where to, or { status, error } when it can't be sent.
 */
async function takeCopy(requestId, send, loginId) {
  const zone = await shopZone();
  await dbExec('BEGIN');
  try {
    const req = await prepare('SELECT customer_id, kind, done_at, cancelled_at FROM privacy_requests WHERE id = ? FOR UPDATE').get(requestId);
    const who = req?.kind === 'copy' && req.customer_id !== null
      ? await prepare('SELECT id, name, email FROM customers WHERE id = ? AND deleted_at IS NULL FOR SHARE').get(req.customer_id)
      : null;
    const refuse = async (status, error) => { await dbExec('ROLLBACK'); return { status, error }; };
    if (!who) return refuse(404, 'Request not found');
    if (req.done_at !== null || req.cancelled_at !== null) return refuse(409, 'That request has already been dealt with.');
    const to = who.email?.trim() || null;
    if (send === 'email' && !to) return refuse(409, `${who.name} has no email address. Download the copy instead.`);
    const signIn = await prepare('SELECT email FROM customer_logins WHERE customer_id = ? AND active = 1 ORDER BY id LIMIT 1').get(who.id);
    const files = [
      ...await dataCopyFiles({ customerId: who.id, email: signIn?.email ?? '', zone, history: await repairsAndPurchases(who.id) }),
      await shopNotesFile(who.id),
    ];
    const shop = await prepare('SELECT s.name, s.slug FROM shops s WHERE s.id = current_setting(\'app.current_shop_id\')::int').get();
    if (send === 'email') {
      const { subject, body } = copyEmail({ shopName: shop.name, files });
      await sendEmailTo({ to, subject, body, customerId: who.id, loginId, templateKey: 'data_copy' });
    }
    const { day } = await prepare("UPDATE privacy_requests SET done_at = now() WHERE id = ? RETURNING to_char((done_at AT TIME ZONE ?)::date, 'YYYY-MM-DD') AS day").get(requestId, zone);
    await dbExec('COMMIT');
    return { files, name: `${shop.slug}-${slug(who.name)}-data-${day}.zip` };
  } catch (err) {
    await dbExec('ROLLBACK').catch(() => {});
    throw err;
  }
}

export function register(route) {
  // screens: cs-privacy, ac-privacy-requests
  route('GET', '/api/privacy-requests', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    sendJson(res, 200, await listRequests());
  });

  // Log a request made in person, by phone, email or letter (finish-customers design 7).
  // screens: cs-privacy
  route('POST', '/api/privacy-requests', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const done = await logRequest((await readJsonBody(req)) ?? {});
    sendJson(res, done.status, done.body);
  });

  // Send the copy: download it, or email it when they have an email (Jack's 9 Nov answer 6).
  // screens: cs-privacy
  route('POST', '/api/privacy-requests/:id/copy', async (req, res, params) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Request not found');
    const { send } = (await readJsonBody(req)) ?? {};
    if (send !== 'download' && send !== 'email') return badRequest(res, 'Download it or email it');
    const ctx = await currentSession(req);
    const copy = await takeCopy(id, send, ctx?.login.id ?? null);
    if (copy.error) return sendJson(res, copy.status, { error: copy.error });
    if (send === 'email') return sendJson(res, 200, { ok: true });
    const zip = zipFiles(copy.files, currentMoment());
    res.writeHead(200, { 'content-type': 'application/zip', 'content-length': zip.length, 'content-disposition': `attachment; filename="${copy.name}"` });
    res.end(zip);
  });

  // screens: cs-list
  route('GET', '/api/privacy-requests/open-count', async (req, res) => {
    sendJson(res, 200, { openCount: await openCount() });
  });

  // screens: cs-privacy-delete
  route('POST', '/api/privacy-requests/:id/delete', async (req, res, params, query, afterRelease) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Request not found');
    const done = await deleteCustomerDetails(id);
    if (!done.ok) return sendJson(res, done.status, done.body);
    // The photos' files go once the save is in, never before (review).
    afterRelease.push(() => removeFiles(done.files));
    sendJson(res, 200, { ok: true });
  });
}
