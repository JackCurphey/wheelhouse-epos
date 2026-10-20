// Which sender each channel uses. Pretend for every channel until Jack says
// otherwise (docs/decisions/2026-10-20-messages-engine.md); a real one is
// added here, with its key names in server/hosted-copy-guard.js and a test.
import * as pretend from './pretend.js';

export function senderFor(/* channel */) {
  return pretend;
}

/** Whether a channel's messages are pretend (every channel, for now). */
export function isPretend(/* channel */) {
  return true;
}
