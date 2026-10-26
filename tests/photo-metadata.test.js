// Photos lose their hidden details when uploaded (openspec/changes/photo-location-data;
// CX-2, docs/decisions/2026-09-01-ownership-signoff.md:111): location, time,
// camera and embedded text go; which way up and the colour profile stay; the
// picture data is never touched. The pictures here are built byte by byte, so
// no real photo (or anyone's location) is in the repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { removePhotoDetails } from '../server/photo-metadata.js';

const b = (...parts) => Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))));
const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const u16le = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff]);
const u32le = (n) => { const x = Buffer.alloc(4); x.writeUInt32LE(n); return x; };
const u32 = (n) => { const x = Buffer.alloc(4); x.writeUInt32BE(n); return x; };
const has = (buf, text) => buf.includes(Buffer.from(text, 'latin1'));

// ---------- JPEG ----------

const segment = (marker, payload) => b([0xff, marker], u16(payload.length + 2), payload);
// An Exif block (little-endian TIFF): IFD0 with Make, DateTime, Orientation
// and a pointer to a GPS block holding a latitude.
function exifBlock({ orientation = 6, bigEndian = false } = {}) {
  const w16 = bigEndian ? u16 : u16le;
  const w32 = bigEndian ? u32 : u32le;
  const make = Buffer.from('TESTMAKE\0', 'latin1');
  const when = Buffer.from('2026:09:01 07:30:00\0', 'latin1');
  const entries = 4;
  const ifd0 = 8;
  const ifd0End = ifd0 + 2 + entries * 12 + 4;
  const makeAt = ifd0End;
  const whenAt = makeAt + make.length;
  const gpsAt = whenAt + when.length;
  const entry = (tag, type, count, value) => b(w16(tag), w16(type), w32(count), value);
  const gps = b(w16(1), entry(0x0001, 2, 2, Buffer.from('N\0\0\0', 'latin1')), w32(0));
  const tiff = b(bigEndian ? 'MM' : 'II', w16(42), w32(ifd0), w16(entries),
    entry(0x010f, 2, make.length, w32(makeAt)),
    entry(0x0112, 3, 1, b(w16(orientation), [0, 0])),
    entry(0x0132, 2, when.length, w32(whenAt)),
    entry(0x8825, 4, 1, w32(gpsAt)),
    w32(0), make, when, gps);
  return b('Exif\0\0', tiff);
}
const ICC = b('ICC_PROFILE\0', [1, 1], 'colour-profile-bytes');
const SCAN = b([0xff, 0xda], u16(8), [1, 1, 0, 0, 0x3f, 0], [0x12, 0x34, 0xff, 0x00, 0x56], [0xff, 0xd9]);
const BEFORE_SCAN = b(segment(0xdb, Buffer.alloc(65, 1)), segment(0xc0, Buffer.from([8, 0, 2, 0, 2, 1, 1, 0x11, 0])));
function jpeg({ exif = exifBlock(), extra = [] } = {}) {
  return b([0xff, 0xd8], segment(0xe0, b('JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0])), exif ? segment(0xe1, exif) : [],
    segment(0xe1, b('http://ns.adobe.com/xap/1.0/\0', '<x:xmpmeta>GPSLatitude 53.57</x:xmpmeta>')),
    segment(0xe2, ICC), segment(0xed, b('Photoshop 3.0\0', '8BIM location')), segment(0xef, b('MAKERNOTE secret')),
    segment(0xfe, b('a comment with an address')), ...extra, BEFORE_SCAN, SCAN);
}
// The Orientation in a cleaned JPEG's Exif block, or null with no block.
function orientationOf(buf) {
  let i = 2;
  while (i < buf.length && buf[i] === 0xff && buf[i + 1] !== 0xda) {
    const len = buf.readUInt16BE(i + 2);
    if (buf[i + 1] === 0xe1 && buf.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
      const t = i + 10;
      const le = buf.toString('latin1', t, t + 2) === 'II';
      const r16 = (o) => (le ? buf.readUInt16LE(t + o) : buf.readUInt16BE(t + o));
      const r32 = (o) => (le ? buf.readUInt32LE(t + o) : buf.readUInt32BE(t + o));
      const ifd = r32(4);
      const n = r16(ifd);
      const tags = [];
      for (let k = 0; k < n; k++) tags.push({ tag: r16(ifd + 2 + k * 12), value: r16(ifd + 2 + k * 12 + 8) });
      return tags;
    }
    i += 2 + len;
  }
  return null;
}

test('a JPEG loses its location, time, camera, XMP, maker notes and comments', () => {
  const out = removePhotoDetails(jpeg()).buffer;
  for (const text of ['TESTMAKE', '2026:09:01', 'GPSLatitude', 'ns.adobe.com/xap', '8BIM', 'MAKERNOTE', 'address']) {
    assert.ok(!has(out, text), `"${text}" is still in the photo`);
  }
});

test('a JPEG keeps which way up it goes, and only that', () => {
  assert.deepEqual(orientationOf(removePhotoDetails(jpeg()).buffer), [{ tag: 0x0112, value: 6 }]);
  assert.deepEqual(orientationOf(removePhotoDetails(jpeg({ exif: exifBlock({ bigEndian: true }) })).buffer), [{ tag: 0x0112, value: 6 }]);
});

test('a JPEG already upright, or with no Exif, gets no Exif block back', () => {
  assert.equal(orientationOf(removePhotoDetails(jpeg({ exif: exifBlock({ orientation: 1 }) })).buffer), null);
  assert.equal(orientationOf(removePhotoDetails(jpeg({ exif: null })).buffer), null);
});

test('a JPEG keeps its colour profile and its picture byte for byte', () => {
  const out = removePhotoDetails(jpeg()).buffer;
  assert.ok(out.includes(segment(0xe2, ICC)), 'the colour profile was lost');
  assert.ok(out.includes(BEFORE_SCAN), 'the picture\'s tables were changed');
  assert.ok(out.subarray(out.length - SCAN.length).equals(SCAN), 'the picture data was changed');
  assert.ok(out.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])));
  assert.equal(out.readUInt16BE(2), 0xffe0, 'JFIF must stay first');
});

test('cleaning twice changes nothing more', () => {
  const once = removePhotoDetails(jpeg()).buffer;
  assert.ok(removePhotoDetails(once).buffer.equals(once));
});

// ---------- PNG ----------

const chunk = (type, data) => b(u32(data.length), type, data, u32(zlib.crc32(b(type, data))));
const IHDR = chunk('IHDR', b(u32(1), u32(1), [8, 2, 0, 0, 0]));
const IDAT = chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0])));
const IEND = chunk('IEND', Buffer.alloc(0));
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_COLOUR = b(chunk('iCCP', b('icc\0', [0], 'profile')), chunk('gAMA', u32(45455)));
const png = () => b(PNG_SIG, IHDR, PNG_COLOUR, chunk('eXIf', exifBlock().subarray(6)), chunk('tEXt', b('Location\0', 'Bolton')),
  chunk('zTXt', b('Comment\0', [0], zlib.deflateSync(Buffer.from('home')))), chunk('iTXt', b('XML:com.adobe.xmp\0', [0, 0], '\0\0', 'GPSLatitude')), IDAT, IEND);

test('a PNG loses its text, and keeps its colour and picture chunks', () => {
  const upright = b(PNG_SIG, IHDR, PNG_COLOUR, chunk('eXIf', exifBlock({ orientation: 1 }).subarray(6)), chunk('tEXt', b('Location\0', 'Bolton')), IDAT, IEND);
  assert.ok(removePhotoDetails(upright).buffer.equals(b(PNG_SIG, IHDR, PNG_COLOUR, IDAT, IEND)));
});

// ---------- WebP ----------

const riffChunk = (type, data) => b(type, u32le(data.length), data, data.length % 2 ? [0] : []);
const vp8x = (flags) => riffChunk('VP8X', b([flags, 0, 0, 0], [0, 0, 0], [0, 0, 0]));
const VP8 = riffChunk('VP8 ', Buffer.from('picture-data!', 'latin1'));
const ICCP = riffChunk('ICCP', Buffer.from('colour', 'latin1'));
const riff = (...chunks) => { const body = b('WEBP', ...chunks); return b('RIFF', u32le(body.length), body); };

test('a WebP loses its Exif and XMP, has those flags cleared and its size put right', () => {
  const out = removePhotoDetails(riff(vp8x(0x20 | 0x08 | 0x04), ICCP, VP8, riffChunk('EXIF', exifBlock().subarray(6)), riffChunk('XMP ', Buffer.from('GPSLatitude', 'latin1')))).buffer;
  assert.ok(out.equals(riff(vp8x(0x20), ICCP, VP8)));
});

test('a simple WebP with nothing hidden is unchanged', () => {
  const plain = riff(VP8);
  assert.ok(removePhotoDetails(plain).buffer.equals(plain));
});

// ---------- Anything else, and damaged pictures ----------

test('a file that isn\'t a picture comes back exactly as it was', () => {
  for (const file of [Buffer.from('%PDF-1.7 a document'), Buffer.from([1, 2, 3, 4, 5]), Buffer.alloc(0)]) {
    assert.ok(removePhotoDetails(file).buffer.equals(file));
  }
});

test('a picture cut short anywhere before its data is refused, never thrown', () => {
  // From the first length at which each is still recognisably that kind of
  // picture (shorter, it's "not a picture" and kept as it is).
  for (const [name, whole, from, upTo] of [['JPEG', jpeg(), 3, jpeg().indexOf(SCAN)], ['PNG', png(), 8, png().length - 1], ['WebP', riff(vp8x(0x0c), VP8, riffChunk('EXIF', Buffer.from('x'))), 12, null]]) {
    const last = upTo ?? whole.length - 1;
    // A PNG cut exactly between whole chunks, after its header, is a picture
    // that ends early: cleaned and kept, not refused.
    const boundaries = new Set();
    if (name === 'PNG') for (let i = 8 + IHDR.length; i < whole.length; i += 12 + whole.readUInt32BE(i)) boundaries.add(i);
    for (let cut = from; cut < last; cut++) {
      if (boundaries.has(cut)) continue;
      let r;
      assert.doesNotThrow(() => { r = removePhotoDetails(whole.subarray(0, cut)); }, `${name} cut at ${cut} threw`);
      assert.ok(r.error, `${name} cut at ${cut} was accepted`);
    }
  }
});

test('a JPEG whose Exif block is damaged still loses it', () => {
  const broken = b('Exif\0\0', 'II', u16le(42), u32le(9999));
  const out = removePhotoDetails(jpeg({ exif: broken }));
  assert.ok(out.buffer, 'refused a photo whose only fault is its hidden details');
  assert.equal(orientationOf(out.buffer), null);
});

// Some phones add a video after the picture ("motion photos"), which can carry
// its own location; nothing after the picture's end is kept.
test('anything after a JPEG\'s end is dropped, such as a motion photo\'s video', () => {
  const trailer = b('ftypmp4 ©xyz+53.5-002.4/');
  const out = removePhotoDetails(b(jpeg(), trailer)).buffer;
  assert.ok(out.subarray(out.length - SCAN.length).equals(SCAN), 'the picture must end at its end marker');
  assert.ok(!has(out, '©xyz'));
});

test('a progressive JPEG keeps every scan up to its end', () => {
  const second = b(segment(0xc4, Buffer.from([0, 1, 2, 0xff, 0xd9])), [0xff, 0xda], u16(8), [1, 1, 0, 0, 0x3f, 0], [0x9a, 0xff, 0x00, 0xff, 0xd3, 0xbc]);
  const pic = b([0xff, 0xd8], BEFORE_SCAN, [0xff, 0xda], u16(8), [1, 1, 0, 0, 0x3f, 0], [0x11], second, [0xff, 0xd9]);
  const out = removePhotoDetails(b(pic, 'TRAILER')).buffer;
  assert.ok(out.equals(pic));
});

test('a JPEG whose picture data is cut short is kept as far as it goes', () => {
  const cut = jpeg().subarray(0, jpeg().length - 3);
  const out = removePhotoDetails(cut).buffer;
  assert.ok(out, 'refused a photo cut short inside its picture data');
  assert.ok(!has(out, 'TESTMAKE'));
});

test('anything after a PNG\'s end is dropped', () => {
  const out = removePhotoDetails(b(PNG_SIG, IHDR, IDAT, IEND, 'GPSLatitude after the end')).buffer;
  assert.ok(out.equals(b(PNG_SIG, IHDR, IDAT, IEND)));
});

// ---------- From the code review ----------

test('padding bytes before a table between scans don\'t cut the picture short', () => {
  // The padding sits after the table, before the next scan's marker.
  const second = b(segment(0xc4, Buffer.from([0, 1, 2])), [0xff, 0xff], [0xff, 0xda], u16(8), [1, 1, 0, 0, 0x3f, 0], [0x9a, 0xbc]);
  const pic = b([0xff, 0xd8], BEFORE_SCAN, [0xff, 0xda], u16(8), [1, 1, 0, 0, 0x3f, 0], [0x11], second, [0xff, 0xd9]);
  assert.ok(removePhotoDetails(b(pic, 'TRAILER')).buffer.equals(pic));
});

test('bytes that aren\'t a marker where one should be keep the rest rather than cut it short', () => {
  const pic = b([0xff, 0xd8], BEFORE_SCAN, [0xff, 0xda], u16(8), [1, 1, 0, 0, 0x3f, 0], [0x11, 0xff, 0xc4], u16(5), [0, 1, 2], [0x41, 0xd9, 0x55], [0xff, 0xd9]);
  const out = removePhotoDetails(pic).buffer;
  assert.ok(out.equals(pic), 'a picture that doesn\'t walk cleanly must be kept whole');
});

test('a WebP with extra bytes after it is cleaned and loses them, not refused', () => {
  const out = removePhotoDetails(b(riff(vp8x(0x08), VP8, riffChunk('EXIF', Buffer.from('GPS'))), [0, 0, 0, 0])).buffer;
  assert.ok(out, 'refused');
  assert.ok(out.equals(riff(vp8x(0), VP8)));
});

test('a PNG that ends without IEND, but whose chunks are whole, is cleaned, not refused', () => {
  const noEnd = b(PNG_SIG, IHDR, chunk('tEXt', b('Location\0', 'Bolton')), IDAT);
  const out = removePhotoDetails(noEnd).buffer;
  assert.ok(out, 'refused');
  assert.ok(out.equals(b(PNG_SIG, IHDR, IDAT)));
});

test('a PNG keeps which way up it goes, in an Exif chunk holding only that', () => {
  const out = removePhotoDetails(png()).buffer;
  const ex = out.indexOf(Buffer.from('eXIf', 'latin1'));
  assert.ok(ex > 0, 'the orientation was lost');
  const data = out.subarray(ex + 4, ex + 4 + out.readUInt32BE(ex - 4));
  assert.ok(!has(data, 'TESTMAKE') && !has(data, '2026:09:01'));
  assert.ok(out.equals(b(PNG_SIG, IHDR, PNG_COLOUR, out.subarray(ex - 4, ex + 8 + data.length), IDAT, IEND)), 'the Exif chunk must sit before the picture data');
  assert.equal(out.readUInt32BE(ex + 4 + data.length), zlib.crc32(b('eXIf', data)), 'bad CRC');
  assert.equal(data.readUInt16LE(8 + 2 + 8), 6);
});
