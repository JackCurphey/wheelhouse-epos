// A test that never finishes (tests/test-runner-limits.test.js).
import test from 'node:test';
test('waits for something that never comes', () => new Promise(() => {}));
