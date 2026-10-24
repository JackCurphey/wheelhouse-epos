// A photo's hidden details removed before it is saved (openspec/changes/
// photo-location-data; CX-2, docs/decisions/2026-09-01-ownership-signoff.md:111):
// where it was taken, when, the camera or phone, and any embedded text. What
// the picture needs to look right stays: which way up it goes and its colour
// profile. Each format is a list of blocks; the blocks kept are copied byte
// for byte, so the picture itself is never decoded or recompressed. Pure: no
// disk, no database.
//
// removePhotoDetails(buffer) returns { buffer } with the cleaned bytes (the
// same bytes for a file that isn't a JPEG, PNG or WebP), or { error } for a
// picture whose blocks don't add up, which can't be cleaned safely.
import zlib from 'node:zlib';

const DAMAGED = { error: 'damaged' };

// The picture a file is, by its first bytes (not what it says it is), or null.
export function sniffImage(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: 'image/png', extension: 'png' };
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return { contentType: 'image/webp', extension: 'webp' };
  return null;
}

export function removePhotoDetails(buffer) {
  const kind = sniffImage(buffer);
  if (!kind) return { buffer };
  if (kind.extension === 'jpg') return cleanJpeg(buffer);
  if (kind.extension === 'png') return cleanPng(buffer);
  return cleanWebp(buffer);
}

// ---------- JPEG ----------
// Markers before the picture data (SOS) are kept, except the APP blocks that
// hold details (Exif, XMP, Photoshop, makers' own) and comments. Kept: JFIF
// (APP0), the ICC colour profile (APP2 "ICC_PROFILE"), Adobe's colour marker
// (APP14). From SOS the picture is copied as it is, up to its end marker:
// anything after it (a motion photo's video, which has its own location) goes.
const ICC_ID = Buffer.from('ICC_PROFILE\0', 'latin1');
const EXIF_ID = Buffer.from('Exif\0\0', 'latin1');

function keepJpegSegment(marker, payload) {
  if (marker === 0xe0 || marker === 0xee) return true;
  if (marker === 0xe2) return payload.subarray(0, ICC_ID.length).equals(ICC_ID);
  if (marker >= 0xe1 && marker <= 0xef) return false;
  return marker !== 0xfe;
}

function cleanJpeg(buf) {
  const kept = [buf.subarray(0, 2)];
  let orientation = null;
  let afterApp0 = 1;
  let i = 2;
  for (;;) {
    if (i + 1 >= buf.length || buf[i] !== 0xff) return DAMAGED;
    let marker = buf[i + 1];
    // Fill bytes: any number of 0xFF before a marker.
    while (marker === 0xff) {
      i += 1;
      if (i + 1 >= buf.length) return DAMAGED;
      marker = buf[i + 1];
    }
    if (marker === 0xda) {
      kept.push(buf.subarray(i, endOfPicture(buf, i)));
      break;
    }
    if (marker === 0xd9) return DAMAGED; // ended before any picture data
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > buf.length) return DAMAGED;
    const length = buf.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > buf.length) return DAMAGED;
    const payload = buf.subarray(i + 4, i + 2 + length);
    if (marker === 0xe1 && orientation === null && payload.subarray(0, 6).equals(EXIF_ID)) {
      orientation = readOrientation(payload.subarray(6));
    }
    if (keepJpegSegment(marker, payload)) {
      kept.push(buf.subarray(i, i + 2 + length));
      if (marker === 0xe0 && kept.length === 2) afterApp0 = 2;
    }
    i += 2 + length;
  }
  // Phones save an upright photo turned and say so in Exif: put back a block
  // holding only that, after JFIF, which must come first.
  if (orientation && orientation !== 1) kept.splice(afterApp0, 0, orientationSegment(orientation));
  return { buffer: Buffer.concat(kept) };
}

// Where the picture ends: just after its EOI marker, found by stepping over
// each scan's data and the tables between scans (a progressive JPEG has
// several), never by searching, since a table can hold any bytes. A picture
// cut short inside its data is kept as far as it goes, and one that doesn't
// step cleanly (no marker where one should be) is kept whole rather than
// guessed at.
function endOfPicture(buf, start) {
  let pos = start;
  for (;;) {
    if (pos + 1 >= buf.length || buf[pos] !== 0xff) return buf.length;
    // Fill bytes: any number of 0xFF before a marker.
    while (buf[pos + 1] === 0xff) {
      pos += 1;
      if (pos + 1 >= buf.length) return buf.length;
    }
    const marker = buf[pos + 1];
    if (marker === 0xd9) return pos + 2;
    if (pos + 4 > buf.length) return buf.length;
    pos += 2 + buf.readUInt16BE(pos + 2);
    if (marker !== 0xda) continue;
    // A scan's data: 0xFF is followed by 0x00 (a stuffed byte), a restart
    // marker or more fill bytes; anything else is the next marker.
    for (;;) {
      if (pos >= buf.length) return buf.length;
      if (buf[pos] !== 0xff) { pos += 1; continue; }
      const next = buf[pos + 1];
      if (next === undefined) return buf.length;
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { pos += 2; continue; }
      if (next === 0xff) { pos += 1; continue; }
      break;
    }
  }
}

// IFD0's Orientation (1 to 8) from a TIFF block, or null if there's none or
// the block doesn't add up (it's dropped either way).
function readOrientation(tiff) {
  if (tiff.length < 8) return null;
  const order = tiff.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const le = order === 'II';
  const r16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const r32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = r32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = r16(ifd);
  for (let k = 0; k < count; k++) {
    const at = ifd + 2 + k * 12;
    if (at + 12 > tiff.length) return null;
    if (r16(at) === 0x0112 && r16(at + 2) === 3) {
      const value = r16(at + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

// A TIFF block with one entry: Orientation.
function orientationTiff(orientation) {
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22);
  return tiff;
}

// An APP1 Exif block with one entry: Orientation.
function orientationSegment(orientation) {
  const payload = Buffer.concat([EXIF_ID, orientationTiff(orientation)]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

// ---------- PNG ----------
// Chunks are copied whole (length, type, data, CRC), except the text chunks,
// which can hold anything (XMP among them), and Exif, which is replaced by
// one holding only the Orientation when the photo is turned. The file ends
// at IEND (anything after it goes), or at its last whole chunk.
const PNG_TEXT = new Set(['tEXt', 'zTXt', 'iTXt']);

function cleanPng(buf) {
  const kept = [buf.subarray(0, 8)];
  let i = 8;
  while (i < buf.length) {
    if (i + 12 > buf.length) return DAMAGED;
    const length = buf.readUInt32BE(i);
    const end = i + 12 + length;
    if (end > buf.length) return DAMAGED;
    const type = buf.toString('latin1', i + 4, i + 8);
    if (type === 'eXIf') {
      const orientation = readOrientation(buf.subarray(i + 8, i + 8 + length));
      if (orientation && orientation !== 1) kept.push(pngChunk('eXIf', orientationTiff(orientation)));
    } else if (!PNG_TEXT.has(type)) {
      kept.push(buf.subarray(i, end));
    }
    i = end;
    if (type === 'IEND') break;
  }
  // A PNG starts with its header chunk; without it there's no picture.
  if (kept.length < 2 || kept[1].toString('latin1', 4, 8) !== 'IHDR') return DAMAGED;
  return { buffer: Buffer.concat(kept) };
}

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// ---------- WebP ----------
// A RIFF file of chunks. EXIF and XMP chunks go, their flags in VP8X are
// cleared, and the RIFF size is set for what's left. A chunk of odd length has
// one padding byte after it. Anything after the RIFF's own size goes.
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function cleanWebp(buf) {
  const size = buf.readUInt32LE(4);
  if (size + 8 > buf.length || size < 4) return DAMAGED;
  const fileEnd = size + 8;
  const kept = [];
  let i = 12;
  while (i < fileEnd) {
    if (i + 8 > fileEnd) return DAMAGED;
    const type = buf.toString('latin1', i, i + 4);
    const length = buf.readUInt32LE(i + 4);
    const end = i + 8 + length + (length % 2);
    if (end > fileEnd) return DAMAGED;
    if (type === 'VP8X') {
      if (length < 10) return DAMAGED;
      const chunk = Buffer.from(buf.subarray(i, end));
      chunk[8] &= ~(VP8X_EXIF | VP8X_XMP);
      kept.push(chunk);
    } else if (type !== 'EXIF' && type !== 'XMP ') {
      kept.push(buf.subarray(i, end));
    }
    i = end;
  }
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...kept]);
  const head = Buffer.from('RIFF\0\0\0\0', 'latin1');
  head.writeUInt32LE(body.length, 4);
  return { buffer: Buffer.concat([head, body]) };
}
