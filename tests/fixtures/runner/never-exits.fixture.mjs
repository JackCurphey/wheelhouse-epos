// Every test passes, but something left open keeps the process alive, as a
// leaked timer, server or connection would (tests/test-runner-limits.test.js).
import test from 'node:test';
setInterval(() => {}, 1000);
test('passes', () => {});
// A safety net: if the runner around this is killed (as when its limits are broken on
// purpose), this file still ends, instead of running on with nothing to stop it.
setTimeout(() => process.exit(1), 60_000);
