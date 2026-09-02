// Who a request came from, and whether it arrived over https.
//
// This used to assume a tunnel sat in front of the app. That mattered for
// more than tidiness: the tunnel overwrote the client-IP header with the
// real client address and stripped whatever a caller tried to put there,
// so trusting it was safe. Nothing does that now, so every forwarding
// header is attacker-controlled unless a proxy we actually trust set it. The per-IP rate limiter on login/signup is what depends on
// this - a key the caller can choose is no rate limit at all, because
// every request can claim to be a new IP.
//
// So the default is to believe nothing and use the socket address. Set
// TRUST_PROXY=1 only when the app is reachable exclusively through a proxy
// that overwrites these headers rather than passing the client's through
// (server/gateway.js does exactly that; docker-compose.yml turns this on
// for the app service for that reason).
export const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

export function clientIp(req, { trustProxy = TRUST_PROXY } = {}) {
  if (trustProxy) {
    // Left-most entry is the original client; anything after it is the
    // chain of proxies that handled the request.
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function isHttpsRequest(req, { trustProxy = TRUST_PROXY } = {}) {
  // Directly-terminated TLS needs no header to prove itself.
  if (req.socket?.encrypted) return true;
  if (trustProxy) return req.headers['x-forwarded-proto'] === 'https';
  return false;
}
