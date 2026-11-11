// A test that never finishes (tests/test-runner-limits.test.js).
import test from 'node:test';
test('waits for something that never comes', () => new Promise(() => {}));
// A safety net: if the runner around this is killed (as when its limits are broken on
// purpose), this file still ends, instead of running on with nothing to stop it.
setTimeout(() => process.exit(1), 60_000);
