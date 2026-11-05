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

// What's cheap to send can be dear to parse: 2 MB of {},{},{} takes 43 MB of heap, and
// 69 MB of it ran the server out of memory. Base64 takes no more than its size, and has
// none of these characters, so counting them tells the two apart without parsing.
// Each makes at most one value. Counted inside strings too: a note's commas are few.
const MAKES_A_VALUE = new Uint8Array(256);
for (const ch of '{[,:') MAKES_A_VALUE[ch.charCodeAt(0)] = 1;
function valuesIn(chunk) {
  let count = 0;
  for (let i = 0; i < chunk.length; i++) count += MAKES_A_VALUE[chunk[i]];
  return count;
}

const SMALL_PUBLIC_BODY_BYTES = 100 * 1024;

export function createBodyReadGate(limits) {
  const keys = new Map(); // key -> { reads, bytes }
  let reads = 0;
  let bytes = 0;
  return {
    limits,
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
  website: createBodyReadGate({ readsPerKey: 10, reads: 200, bytesPerKey: 100 * MB, bytes: 200 * MB, smallBody: SMALL_PUBLIC_BODY_BYTES, values: 10_000 }),
  // By address. Staff sign-up, sign-out and password posts, apart from the website.
  // Signing in with WorkOS is GETs with no body, so it never comes here.
  staffAccounts: createBodyReadGate({ readsPerKey: 10, reads: 100, bytesPerKey: 10 * MB, bytes: 20 * MB, smallBody: SMALL_PUBLIC_BODY_BYTES, values: 10_000 }),
  // By address. Shopify's, which retries. Parsed only once its signature is good, so
  // no limit on what it's made of.
  webhook: createBodyReadGate({ readsPerKey: 10, reads: 100, bytesPerKey: 30 * MB, bytes: 30 * MB }),
  // By shop. Uploads have a gate of their own, so however many are stalled, every
  // shop's sales, payments and till syncs still get through. 150 MB is a full Citrus
  // Lime file, 42 MB, and five job attachments at 21 MB, all arriving at once.
  signedInUploads: createBodyReadGate({ readsPerKey: 200, reads: 2000, bytesPerKey: 150 * MB, bytes: 200 * MB, values: 200_000 }),
  // By shop: staff's and tills' small bodies, each at most 2 MB and usually far less.
  signedIn: createBodyReadGate({ readsPerKey: 200, reads: 2000, bytesPerKey: 20 * MB, bytes: 50 * MB, values: 200_000 }),
};

// Whatever a socket's requests need done when it closes, under one listener: any
// number of requests can be pipelined on one connection.
const onSocketClose = new WeakMap(); // socket -> Set of functions
function whenSocketCloses(socket, fn) {
  let waiting = onSocketClose.get(socket);
  if (!waiting) {
    waiting = new Set();
    onSocketClose.set(socket, waiting);
    socket.once('close', () => { for (const each of waiting) each(); });
  }
  waiting.add(fn);
  return () => waiting.delete(fn);
}

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
// - maxBody: the most it ever reads, if over a small route's: 2 MB, or 100 KB where a
//   gate with no sign-in says so;
// - answerOverflow: it answers a body too large, as readJsonBody's option of that name;
// - upload: it gets the longer deadline.
// The dispatcher says which gate, and the key if it isn't the caller's address.
export async function readBodyFirst(req, res, { maxBody: routeMaxBody, answerOverflow = false, upload = false } = {}, { gate, key = clientIp(req) } = {}) {
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
  if (place) {
    const forget = whenSocketCloses(req.socket, place.leave);
    res.once('finish', () => {
      forget();
      place.leave();
    });
  }

  const maxBody = routeMaxBody ?? gate?.limits.smallBody ?? SMALL_BODY_BYTES;
  const maxValues = gate?.limits.values ?? Infinity;
  const chunks = [];
  let bytes = 0;
  let values = 0;
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
      if (maxValues !== Infinity) {
        values += valuesIn(chunk);
        if (values > maxValues) return finish('tangled');
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
  if (outcome === 'tangled') {
    answerAndClose(res, 400, 'That’s too much to send in one go.');
    return false;
  }
  // Too large goes on to the route, whose reader refuses it in the route's own words.
  holdRequestBody(req, { chunks, bytes, overflowed });
  return true;
}
