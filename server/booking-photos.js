// Customer photos on a booking request: count, size and real file type checked
// before anything is written. Pure: no database, no disk.
// Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
// Base64 inflates bytes by ~1.37x; same headroom rule as MAX_ATTACHMENT_BODY_BYTES.
export const MAX_BOOKING_BODY_BYTES = Math.ceil(MAX_PHOTOS * MAX_PHOTO_BYTES * 1.4);

const UNREADABLE = 'A photo could not be read — please try adding it again';
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// The type comes from the file's own first bytes, never from a name or type the browser claims.
function sniff(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: 'image/png', extension: 'png' };
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return { contentType: 'image/webp', extension: 'webp' };
  return null;
}

export function readBookingPhotos(input) {
  if (input === undefined || input === null) return { value: [] };
  if (!Array.isArray(input)) return { error: UNREADABLE };
  if (input.length > MAX_PHOTOS) return { error: 'You can add up to 5 photos' };
  const value = [];
  for (const item of input) {
    const data = item && typeof item === 'object' ? item.dataBase64 : undefined;
    if (typeof data !== 'string' || !BASE64.test(data)) return { error: UNREADABLE };
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) return { error: UNREADABLE };
    if (buffer.length > MAX_PHOTO_BYTES) return { error: 'Each photo can be up to 10 MB' };
    const type = sniff(buffer);
    if (!type) return { error: 'Only photos can be added (JPEG, PNG or WebP)' };
    value.push({ buffer, ...type });
  }
  return { value };
}
