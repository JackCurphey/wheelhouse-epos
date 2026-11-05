// Reads a request's whole body before the request takes a database connection
// (openspec/changes/body-read-first). There are 10 connections for every shop, so
// a client that sends part of a body and goes quiet mustn't be holding one. The
// dispatcher calls this; the routes go on calling readJsonBody and readRawBody,
// which then use what was read here, and which still apply each route's own limit.
//
// With no connection to wait on, nothing else limits how many reads can be going
// on at once or how much memory they take, so this has to:
// - a deadline for the whole body, however slowly its bytes arrive;
// - gates, each limiting reads at once and bytes held, per key and overall. A place
//   is held only while the body is being read: after that the database pool limits
//   the work. Its bytes are counted until the request is over, as they're memory.
import { holdRequestBody, sendJson } from './http.js';
import { clientIp } from '../proxy-trust.js';

const milliseconds = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);
// Long enough for 2 MB on a poor phone signal. Uploads stay under Node's own limit
// of 5 minutes for a whole request. Tests set shorter ones.
const BODY_DEADLINE_MS = milliseconds(process.env.WH_BODY_DEADLINE_MS, 30_000);
const UPLOAD_BODY_DEADLINE_MS = milliseconds(process.env.WH_UPLOAD_BODY_DEADLINE_MS, 240_000);

const SMALL_BODY_BYTES = 2_000_000;

const MB = 1024 * 1024;

export function createBodyReadGate(limits) {
  const keys = new Map(); // key -> { reads, bytes }
  let reads = 0;
  let bytes = 0;
  return {
    // A place for one read, or null if there is none to be had.
    enter(key) {
      const entry = keys.get(key) ?? { reads: 0, bytes: 0 };
      if (reads >= limits.reads || entry.reads >= limits.readsPerKey) return null;
      keys.set(key, entry);
      entry.reads++;
      reads++;
      let held = 0;
      let reading = true;
      let left = false;
      const readDone = () => {
        if (!reading) return;
        reading = false;
        entry.reads--;
        reads--;
      };
      return {
        // False if these bytes would go over a limit; then they aren't counted.
        hold(count) {
          if (entry.bytes + count > limits.bytesPerKey || bytes + count > limits.bytes) return false;
          entry.bytes += count;
          bytes += count;
          held += count;
          return true;
        },
        // The body has been read, or never will be: the place is free.
        readDone,
        // The request is over: its body is memory no longer.
        leave() {
          if (left) return;
          left = true;
          readDone();
          entry.bytes -= held;
          bytes -= held;
          if (entry.reads === 0 && entry.bytes === 0) keys.delete(key);
        },
      };
    },
  };
}

// Separate, so one kind of caller can't use up another's. The numbers are for Jack
// to overrule (docs/decisions/decided-while-building.md, 5 Nov). Together they are
// at most 500 MB, for a container of 1 GB.
export const readGates = {
  // By address. A booking with photos, about 73 MB, is the most anyone can send
  // with no sign-in; 100 MB leaves room for one and a little more.
  website: createBodyReadGate({ readsPerKey: 10, reads: 200, bytesPerKey: 100 * MB, bytes: 200 * MB }),
  // By address. So stalled bookings can't stop a shop's staff signing in.
  staffSignIn: createBodyReadGate({ readsPerKey: 10, reads: 100, bytesPerKey: 10 * MB, bytes: 20 * MB }),
  // By address. Shopify's, which retries.
  webhook: createBodyReadGate({ readsPerKey: 10, reads: 100, bytesPerKey: 30 * MB, bytes: 30 * MB }),
  // By shop, staff and tills together. 150 MB is a full Citrus Lime file, 42 MB, and
  // five job attachments at 21 MB, all arriving at the same moment.
  signedIn: createBodyReadGate({ readsPerKey: 200, reads: 2000, bytesPerKey: 150 * MB, bytes: 250 * MB }),
};

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
// The dispatcher says which gate, and the key if it isn't the caller's address.
export async function readBodyFirst(req, res, { maxBody = SMALL_BODY_BYTES, answerOverflow = false, upload = false } = {}, { gate, key = clientIp(req) } = {}) {
  // Nothing to wait for, whatever has happened to the client since.
  if (!hasBody(req)) {
    holdRequestBody(req, { chunks: [], bytes: 0, overflowed: false });
    return true;
  }
  if (req.destroyed) return false;

  const place = gate ? gate.enter(key) : null;
  if (gate && !place) {
    tooManyAtOnce(res);
    return false;
  }
  // The answer has gone, or the connection has. Not the response's 'close': on Node
  // 22 it never fires for a pipelined response that was never given the socket.
  const socket = req.socket;
  const leave = () => {
    socket.off('close', leave);
    place?.leave();
  };
  res.once('finish', leave);
  socket.once('close', leave);

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
      place?.readDone();
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

  // Going no further, so what it held is free now, however slowly a client hears why.
  if (outcome === 'gone' || outcome === 'late' || outcome === 'busy') leave();
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
