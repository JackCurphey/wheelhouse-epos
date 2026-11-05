// Reads a request's whole body before the request takes a database connection
// (openspec/changes/body-read-first). There are 10 connections for every shop, so
// a client that sends part of a body and goes quiet mustn't be holding one. The
// dispatcher calls this; the routes go on calling readJsonBody and readRawBody,
// which then use what was read here, and which still apply each route's own limit.
//
// With no connection to wait on, nothing else limits how many reads can be going
// on at once or how much memory they take, so this has to:
// - a deadline for the whole body, however slowly its bytes arrive;
// - for anyone not yet known to be staff or a till, a limit per address and for the
//   whole server, on requests at once with a body and on bytes held.
import { holdRequestBody, sendJson } from './http.js';
import { clientIp } from '../proxy-trust.js';

const milliseconds = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);
// Long enough for 2 MB on a poor phone signal. Uploads stay under Node's own limit
// of 5 minutes for a whole request. Tests set shorter ones.
const BODY_DEADLINE_MS = milliseconds(process.env.WH_BODY_DEADLINE_MS, 30_000);
const UPLOAD_BODY_DEADLINE_MS = milliseconds(process.env.WH_UPLOAD_BODY_DEADLINE_MS, 240_000);

const SMALL_BODY_BYTES = 2_000_000;

// A booking with its photos is the largest thing anyone can send with no sign-in,
// about 73 MB. The bytes per address leave room for one of those and a little more.
export const PUBLIC_READ_LIMITS = {
  readsPerAddress: 10,
  reads: 200,
  bytesPerAddress: 100 * 1024 * 1024,
  bytes: 300 * 1024 * 1024,
};

export function createBodyReadGate(limits = PUBLIC_READ_LIMITS) {
  const addresses = new Map(); // address -> { reads, bytes }
  let reads = 0;
  let bytes = 0;
  return {
    // A place for one read, or null if there is none to be had.
    enter(address) {
      const entry = addresses.get(address) ?? { reads: 0, bytes: 0 };
      if (reads >= limits.reads || entry.reads >= limits.readsPerAddress) return null;
      addresses.set(address, entry);
      entry.reads++;
      reads++;
      let held = 0;
      let left = false;
      return {
        // False if these bytes would go over a limit; then they aren't counted.
        hold(count) {
          if (entry.bytes + count > limits.bytesPerAddress || bytes + count > limits.bytes) return false;
          entry.bytes += count;
          bytes += count;
          held += count;
          return true;
        },
        // When the request is over: its place is free and its body no longer memory.
        leave() {
          if (left) return;
          left = true;
          entry.reads--;
          reads--;
          entry.bytes -= held;
          bytes -= held;
          if (entry.reads === 0) addresses.delete(address);
        },
      };
    },
  };
}

const publicReads = createBodyReadGate();

const hasBody = (req) => Boolean(req.headers['transfer-encoding']) || Number(req.headers['content-length']) > 0;

function answerAndClose(res, status, error, headers = {}) {
  res.setHeader('connection', 'close');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  sendJson(res, status, { error });
}

const tooManyAtOnce = (res) =>
  answerAndClose(res, 429, 'Too many requests at once. Please try again in a moment.', { 'Retry-After': '5' });

// True if the route should go on. False if the request has been dealt with here:
// answered, or its client has gone. A route says what it needs when it's registered:
// - maxBody: the most it ever reads, if over the 2 MB of a small route;
// - answerOverflow: it answers a body too large, as readJsonBody's option of that name;
// - upload: it gets the longer deadline.
export async function readBodyFirst(req, res, { maxBody = SMALL_BODY_BYTES, answerOverflow = false, upload = false } = {}, { public: isPublic = false } = {}) {
  // Nothing to wait for, whatever has happened to the client since.
  if (!hasBody(req)) {
    holdRequestBody(req, { chunks: [], bytes: 0, overflowed: false });
    return true;
  }
  if (req.destroyed) return false;

  const place = isPublic ? publicReads.enter(clientIp(req)) : null;
  if (isPublic && !place) {
    tooManyAtOnce(res);
    return false;
  }
  if (place) res.once('close', place.leave);

  const chunks = [];
  let bytes = 0;
  let overflowed = false;
  const outcome = await new Promise((resolve) => {
    const timer = setTimeout(() => finish('late'), upload ? UPLOAD_BODY_DEADLINE_MS : BODY_DEADLINE_MS);
    function finish(result) {
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onGone);
      req.off('close', onGone);
      req.pause();
      resolve(result);
    }
    function onData(chunk) {
      bytes += chunk.length;
      if (overflowed) {
        // Still reading so the client can be answered; stop at twice the cap.
        if (bytes > maxBody * 2) finish('over');
        return;
      }
      if (bytes > maxBody) {
        overflowed = true;
        chunks.length = 0;
        if (!answerOverflow) finish('over');
        return;
      }
      if (place && !place.hold(chunk.length)) return finish('busy');
      chunks.push(chunk);
    }
    function onEnd() { finish('read'); }
    function onGone() { finish('gone'); }
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onGone);
    req.on('close', onGone);
  });

  if (outcome === 'gone') return false;
  if (outcome === 'late') {
    answerAndClose(res, 408, 'That took too long to arrive. Please try again.');
    return false;
  }
  if (outcome === 'busy') {
    tooManyAtOnce(res);
    return false;
  }
  // Too large goes on to the route, whose reader refuses it in the route's own words.
  holdRequestBody(req, { chunks, bytes, overflowed });
  return true;
}
