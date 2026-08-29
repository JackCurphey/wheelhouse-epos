// Sends a text via Twilio's REST API. Deployment-wide credentials (one
// Twilio account for every shop, same as every other cross-cutting secret
// in this app - see server/load-env.js) rather than per-shop config, since
// nothing here needs a per-shop Twilio sub-account yet. No SDK dependency -
// Node's built-in fetch is enough for one REST call.

// Hand-rolled, UK-biased - not a full E.164 validator. A number Twilio
// itself rejects still comes back as a normal {ok:false, error} from
// sendSms, so an imperfect normalization here isn't a silent failure.
export function normalizePhoneToE164(raw) {
  const trimmed = String(raw || '').replace(/[\s()-]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('0')) return `+44${trimmed.slice(1)}`;
  return trimmed;
}

export async function sendSms(toPhone, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: 'SMS is not configured on this server' };
  }

  const to = normalizePhoneToE164(toPhone);
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });

  let res;
  try {
    res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
  } catch (err) {
    return { ok: false, error: `Could not reach Twilio: ${err.message}` };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: (data && data.message) || `Twilio returned ${res.status}` };
  }
  return { ok: true, sid: data.sid };
}
