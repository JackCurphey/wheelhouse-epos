// Where "Ask us to help" lands (mv-help; Jack, 15 Oct; openspec/changes/citrus-import-fix,
// design 15). Pretend until Jack says yes to a real inbox, which is a real account:
// nothing leaves the server, and what was asked stays in move_help_requests. A real
// one goes here behind the same send(), with its key names in server/hosted-copy-guard.js.
import { dbExec, prepare } from '../db.js';

const pretend = {
  async send() {
    return { providerId: 'pretend' };
  },
};
export const helpInbox = () => pretend;

/**
 * Records what was asked, commits, then passes it on. Sent twice, it's recorded once
 * and passed on once; if passing it on failed, it stays recorded, unsent, and throws,
 * and sending again with the same key tries again. Returns { reused } when the key was
 * used for something else. Inside the request's shop.
 */
export async function sendHelp({ text, card, who, replyTo, shopName, keyHash, bodyHash }, inbox = helpInbox()) {
  await prepare(
    `INSERT INTO move_help_requests (what_looks_wrong, card, asked_by_login_id, asked_by_employee_id, asked_by_name, reply_to, request_key_hash, request_body_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (shop_id, request_key_hash) DO NOTHING RETURNING id`
  ).get(text, card, who.loginId, who.employeeId, who.name, replyTo, keyHash, bodyHash);
  await dbExec('BEGIN');
  try {
    // Held while it's passed on, so a second send at the same moment waits and finds it sent.
    const asked = await prepare('SELECT id, provider_id, request_body_hash FROM move_help_requests WHERE request_key_hash = ? FOR UPDATE').get(keyHash);
    if (asked.request_body_hash !== bodyHash) {
      await dbExec('ROLLBACK');
      return { reused: true };
    }
    if (asked.provider_id === null) {
      const sent = await inbox.send({ text, card, who: who.name, replyTo, shopName });
      await prepare('UPDATE move_help_requests SET provider_id = ? WHERE id = ?').run(sent.providerId, asked.id);
    }
    await dbExec('COMMIT');
    return { reused: false };
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
}
