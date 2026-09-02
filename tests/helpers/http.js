// One JSON request against a running server, carrying an optional session
// cookie. Shared by the portal and staff helpers so both speak the same
// { status, body } shape.
export async function jsonRequest(baseUrl, cookie, path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: res.status, body: await res.json() };
}

// Pulls one named cookie out of a response's Set-Cookie headers, formatted
// ready to send straight back as a Cookie header.
export function readCookie(res, name) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const [key, value] = pair.split('=');
    if (key.trim() === name) return `${name}=${value}`;
  }
  return null;
}
