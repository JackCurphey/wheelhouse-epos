// The hosted test copy's start-up guard (add-hosted-copy design §5; the
// messages engine, Jack 20 Oct: pretend for now). With WHEELHOUSE_HOSTED_COPY=1
// the server refuses to start, naming the setting, if anything could make it
// act for real: a real sending key, a NODE_ENV other than production, or
// transaction-scoped tenancy. Checked before any migration runs.
//
// Each outside service's real sender adds its key names here, with a test.
export const REAL_KEY_PREFIXES = ['TWILIO_', 'EMAIL_', 'WHATSAPP_'];

/** Why the hosted copy mustn't start, or null. */
export function hostedCopyRefusal(env) {
  if (env.WHEELHOUSE_HOSTED_COPY !== '1') return null;
  const key = Object.keys(env).find((k) => env[k] && REAL_KEY_PREFIXES.some((p) => k.startsWith(p)));
  if (key) return `This is a test copy of Wheelhouse (WHEELHOUSE_HOSTED_COPY=1): remove ${key}. A test copy never sends real messages.`;
  if (env.NODE_ENV !== 'production') return 'This is a test copy of Wheelhouse (WHEELHOUSE_HOSTED_COPY=1): NODE_ENV must be production.';
  if (env.DB_TENANT_SCOPE && env.DB_TENANT_SCOPE !== 'session') {
    return `This is a test copy of Wheelhouse (WHEELHOUSE_HOSTED_COPY=1): DB_TENANT_SCOPE must be session, not ${env.DB_TENANT_SCOPE}.`;
  }
  return null;
}
