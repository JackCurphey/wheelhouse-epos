// Every test passes, but something left open keeps the process alive, as a
// leaked timer, server or connection would (tests/test-runner-limits.test.js).
import test from 'node:test';
setInterval(() => {}, 1000);
test('passes', () => {});
