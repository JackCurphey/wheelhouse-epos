// Customer photos on a booking, checked without a server or a disk.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBookingPhotos, MAX_PHOTO_BYTES } from '../server/booking-photos.js';
import { tinyJpeg, tinyPng, tinyWebp, JPEG_OVERHEAD, LOCATION_SIGNS } from './helpers/pictures.js';

const photo = (bytes) => ({ dataBase64: bytes.toString('base64') });
const UNREADABLE = 'A photo could not be read — please try adding it again';

test('JPEG, PNG and WebP are each identified from their first bytes', () => {
  const r = readBookingPhotos([photo(tinyJpeg()), photo(tinyPng()), photo(tinyWebp())]);
  assert.deepEqual(r.value.map((p) => [p.contentType, p.extension]), [
    ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
  ]);
  assert.ok(Buffer.isBuffer(r.value[0].buffer));
});

test('a text file is refused, whatever it is called', () => {
  const r = readBookingPhotos([{ dataBase64: Buffer.from('hello there').toString('base64'), filename: 'x.jpg', contentType: 'image/jpeg' }]);
  assert.equal(r.error, 'Only photos can be added (JPEG, PNG or WebP)');
});

test('a RIFF file that is not WebP is refused', () => {
  const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WAVE'), Buffer.alloc(8)]);
  assert.equal(readBookingPhotos([{ dataBase64: wav.toString('base64') }]).error, 'Only photos can be added (JPEG, PNG or WebP)');
});

test('5 photos are accepted, 6 are refused', () => {
  assert.equal(readBookingPhotos(Array(5).fill(photo(tinyJpeg()))).value.length, 5);
  assert.equal(readBookingPhotos(Array(6).fill(photo(tinyJpeg()))).error, 'You can add up to 5 photos');
});

test('exactly 10 MB is accepted, one byte more is refused', () => {
  const at = tinyJpeg('', MAX_PHOTO_BYTES - JPEG_OVERHEAD);
  assert.equal(at.length, MAX_PHOTO_BYTES);
  assert.equal(readBookingPhotos([{ dataBase64: at.toString('base64') }]).value.length, 1);
  const over = tinyJpeg('', MAX_PHOTO_BYTES - JPEG_OVERHEAD + 1);
  assert.equal(readBookingPhotos([{ dataBase64: over.toString('base64') }]).error, 'Each photo can be up to 10 MB');
});

test('a non-list, empty data, non-string data and non-base64 text are each refused', () => {
  assert.equal(readBookingPhotos('nope').error, UNREADABLE);
  assert.equal(readBookingPhotos({}).error, UNREADABLE);
  assert.equal(readBookingPhotos([{ dataBase64: '' }]).error, UNREADABLE);
  assert.equal(readBookingPhotos([{ dataBase64: 12 }]).error, UNREADABLE);
  assert.equal(readBookingPhotos([{}]).error, UNREADABLE);
  assert.equal(readBookingPhotos([null]).error, UNREADABLE);
  assert.equal(readBookingPhotos([{ dataBase64: '!!! not base64 !!!' }]).error, UNREADABLE);
});

test('absent, null and an empty list all mean no photos', () => {
  for (const input of [undefined, null, []]) assert.deepEqual(readBookingPhotos(input), { value: [] });
});

// CX-2 (openspec/changes/photo-location-data): a photo's hidden details go
// before it's saved; which way up and the picture itself stay.
test('a photo taken at home comes back without where, when or which phone', () => {
  for (const pic of [tinyJpeg('home', 16, { withLocation: true }), tinyPng('home', { withLocation: true })]) {
    const [p] = readBookingPhotos([photo(pic)]).value;
    for (const sign of LOCATION_SIGNS) assert.ok(!p.buffer.includes(Buffer.from(sign, 'latin1')), `"${sign}" is still in the photo`);
    assert.ok(p.buffer.includes(Buffer.from('home')), 'the picture itself was lost');
  }
});

test('a photo whose blocks don\'t add up is refused, not saved with its details', () => {
  const damaged = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00]), Buffer.from('Exif\0\0 cut short')]);
  assert.equal(readBookingPhotos([photo(damaged)]).error, UNREADABLE);
});
