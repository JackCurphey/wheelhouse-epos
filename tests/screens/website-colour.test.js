// The main colour on the Website start's step 2 (openspec/changes/website-management,
// design 4, tasks 3.2 and 3.4): colours suggested from the logo's pixels, named
// from a short list, and the same reading check the server makes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { colourProblem, coloursFromPixels, colourName } from '../../src/screens/website/website-colour.ts';

// RGBA pixels: `n` of each [r, g, b, a].
const pixels = (...runs) => new Uint8ClampedArray(runs.flatMap(([n, rgba]) => Array.from({ length: n }, () => rgba).flat()));

test('a logo made of two known colours suggests those two, commonest first', () => {
  const logo = pixels([60, [0x2f, 0x6b, 0x4f, 255]], [100, [0x1a, 0x3f, 0x66, 255]]);
  assert.deepEqual(coloursFromPixels(logo), [{ hex: '#1A3F66', name: 'Dark blue' }, { hex: '#2F6B4F', name: 'Green' }]);
});

test('see-through, white and other hard-to-read pixels are never suggested', () => {
  const logo = pixels([500, [255, 255, 255, 255]], [400, [0xf5, 0xd9, 0x0a, 255]], [300, [0x1a, 0x3f, 0x66, 0]], [10, [0x2f, 0x6b, 0x4f, 255]]);
  assert.deepEqual(coloursFromPixels(logo), [{ hex: '#2F6B4F', name: 'Green' }]);
  assert.deepEqual(coloursFromPixels(pixels([20, [255, 255, 255, 255]])), []);
});

test('the screen makes the same reading check as the server', () => {
  for (const colour of ['#1A3F66', '#2F6B4F', '#2A2822']) assert.equal(colourProblem(colour), null, colour);
  for (const colour of ['#F5D90A', '#FFFFFF', '#7FB3E0']) assert.match(colourProblem(colour), /hard to read/, colour);
  assert.equal(colourName('#2A2822'), 'Charcoal');
});
