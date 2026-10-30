// The shop's privacy requests (openspec/changes/delete-account, design 4;
// customer service decision 9; Jack's 30 Oct answer 3): the dated list, and
// deleting someone's details, the Owner only until roles are built (answer
// 3.7). The open count is for the link on Customers.
import { notFound, sendJson } from '../lib/http.js';
import { ownerOnly } from '../lib/owner-only.js';
import { deleteCustomerDetails, listRequests, openCount, removeFiles } from '../privacy-requests.js';

const OWNER_ONLY = 'Only the shop’s owner can deal with privacy requests';

export function register(route) {
  // screens: cs-privacy, ac-privacy-requests
  route('GET', '/api/privacy-requests', async (req, res) => {
    if (await ownerOnly(req, res, OWNER_ONLY)) return;
    sendJson(res, 200, await listRequests());
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
