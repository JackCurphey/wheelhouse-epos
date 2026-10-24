// Small, well-formed pictures for tests (openspec/changes/photo-location-data):
// uploads now have their hidden details removed, which needs a picture whose
// blocks add up, so the first bytes alone no longer pass. Each carries
// `marker` inside its picture data, so a test can find its file on disk.
// None holds a real photo or a real place.
import zlib from 'node:zlib';

const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

// An Exif block with a camera make "TESTMAKE", a time and a GPS latitude, as a
// phone writes them. LOCATION_SIGNS are the bytes a cleaned photo mustn't hold.
export const LOCATION_SIGNS = ['TESTMAKE', '2026:09:01 07:30:00', 'GPSLatitude'];
export function exifWithLocation() {
  const le16 = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff]);
  const le32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
  const make = Buffer.from('TESTMAKE\0', 'latin1');
  const when = Buffer.from('2026:09:01 07:30:00\0', 'latin1');
  const ifdEnd = 8 + 2 + 3 * 12 + 4;
  const entry = (tag, type, count, value) => Buffer.concat([le16(tag), le16(type), le32(count), value]);
  const gpsAt = ifdEnd + make.length + when.length;
  const gps = Buffer.concat([le16(1), entry(0x0002, 2, 4, Buffer.from('53N\0', 'latin1')), le32(0)]);
  return Buffer.concat([Buffer.from('Exif\0\0II', 'latin1'), le16(42), le32(8), le16(3),
    entry(0x010f, 2, make.length, le32(ifdEnd)),
    entry(0x0132, 2, when.length, le32(ifdEnd + make.length)),
    entry(0x8825, 4, 1, le32(gpsAt)),
    le32(0), make, when, gps]);
}
const xmp = () => Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>GPSLatitude 53.57</x:xmpmeta>', 'latin1');

// A JPEG: start, (Exif and XMP when asked), a scan holding the marker and
// `size` zero bytes, then its end. With no details it comes back unchanged.
export function tinyJpeg(marker = '', size = 64, { withLocation = false } = {}) {
  const seg = (m, payload) => Buffer.concat([Buffer.from([0xff, m]), u16(payload.length + 2), payload]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]),
    withLocation ? Buffer.concat([seg(0xe1, exifWithLocation()), seg(0xe1, xmp())]) : Buffer.alloc(0),
    Buffer.from([0xff, 0xda]), u16(2), Buffer.from(marker, 'latin1'), Buffer.alloc(size), Buffer.from([0xff, 0xd9])]);
}
// How much a tinyJpeg adds around `size`, for one exactly n bytes long.
export const JPEG_OVERHEAD = tinyJpeg('', 0).length;

const chunk = (type, data) => Buffer.concat([u32(data.length), Buffer.from(type, 'latin1'), data, u32(zlib.crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])))]);
// A PNG with the marker in its picture data (IDAT), and an Exif chunk and a
// text chunk when asked.
export function tinyPng(marker = '', { withLocation = false } = {}) {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.concat([u32(1), u32(1), Buffer.from([8, 2, 0, 0, 0])])),
    withLocation ? Buffer.concat([chunk('eXIf', exifWithLocation().subarray(6)), chunk('iTXt', xmp())]) : Buffer.alloc(0),
    chunk('IDAT', Buffer.from(marker || 'picture', 'latin1')), chunk('IEND', Buffer.alloc(0))]);
}

// A simple WebP with the marker in its picture chunk.
export function tinyWebp(marker = '') {
  const data = Buffer.from(marker || 'picture', 'latin1');
  const vp8 = Buffer.concat([Buffer.from('VP8 ', 'latin1'), Buffer.alloc(4), data, data.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
  vp8.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), vp8]);
  const head = Buffer.from('RIFF\0\0\0\0', 'latin1');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}
