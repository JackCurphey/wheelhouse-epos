// Which sender each channel uses. Pretend for every channel until Jack says
// otherwise (docs/decisions/2026-10-20-messages-engine.md); a real one is
// added here, with its key names in server/hosted-copy-guard.js and a test.
// A sender is given { channel, to, subject, body, attachments }, where each
// attachment is { filename, contentType, content: Buffer } (email only;
// openspec/changes/message-attachments design 3).
import * as pretend from './pretend.js';

// A plain object, not the module itself, so a test can watch what it is given.
const PRETEND = { send: pretend.send };

export function senderFor(/* channel */) {
  return PRETEND;
}

/** Whether a channel's messages are pretend (every channel, for now). */
export function isPretend(/* channel */) {
  return true;
}
