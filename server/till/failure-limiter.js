// server/till/failure-limiter.js
// A limiter that only ever advances on a FAILED lookup. A limiter that also
// counts successful requests (see the review finding on Task 6) can lock out
// a working till: a post-outage burst of 21+ syncs, or a dead neighbouring
// till retrying, hits the count before any single request is wrong, and a
// valid till never gets the chance to reset it. Keying on failures alone
// means legitimate traffic - however heavy - never moves the count at all.
export function makeFailureLimiter(maxFailures, windowMs, now = () => Date.now()) {
  const failures = new Map(); // key -> { count, windowStart }

  function currentCount(key) {
    const entry = failures.get(key);
    if (!entry) return 0;
    if (now() - entry.windowStart >= windowMs) {
      failures.delete(key);
      return 0;
    }
    return entry.count;
  }

  return {
    isBlocked(key) {
      return currentCount(key) >= maxFailures;
    },
    recordFailure(key) {
      const count = currentCount(key);
      if (count === 0) {
        failures.set(key, { count: 1, windowStart: now() });
      } else {
        failures.get(key).count = count + 1;
      }
    },
    clear(key) {
      failures.delete(key);
    },
  };
}
