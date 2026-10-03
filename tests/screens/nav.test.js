// The staff app's rooms sidebar list must match the approved drawings.
//
// src/staff/nav.ts is copied from ROOMS_DIARY in the journey generator
// (docs/design/user-journeys/generator/diary.mjs), which drew every approved
// board. If either changes without the other, this fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, roomsFor, NAV_ROUTES } from '../../src/staff/nav.ts';
import { ROOMS_DIARY } from '../../docs/design/user-journeys/generator/diary.mjs';

test('the rooms, their items, labels, icons and roles are the drawings\' own', () => {
  const drawn = ROOMS_DIARY.map(([room, items]) => ({
    room,
    items: items.map(([key, label, icon, roles]) => ({ key, label, icon, roles })),
  }));
  assert.deepEqual(ROOMS, drawn);
});

test('a mechanic sees only the Workshop room', () => {
  assert.deepEqual(roomsFor('K').map((r) => r.room), ['Workshop']);
});

test('staff see Front desk, Workshop, Stockroom and only Today in the Office', () => {
  const rooms = roomsFor('S');
  assert.deepEqual(rooms.map((r) => r.room), ['Front desk', 'Workshop', 'Stockroom', 'Office']);
  assert.deepEqual(rooms.find((r) => r.room === 'Office').items.map((i) => i.key), ['today']);
});

test('the owner sees every item', () => {
  const all = ROOMS.flatMap((r) => r.items.map((i) => i.key));
  assert.deepEqual(roomsFor('O').flatMap((r) => r.items.map((i) => i.key)), all);
});

test('every item opens its own page under /workshop', () => {
  for (const room of ROOMS) {
    for (const item of room.items) assert.equal(NAV_ROUTES[item.key], `/workshop/${item.key}`);
  }
});
