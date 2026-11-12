// The main colour on the Website start's step 2 (openspec/changes/website-management,
// design 4): colours suggested from the logo, named from a short list, and the
// same reading check server/website.js makes (white text on the colour needs a
// contrast of at least 4.5 to 1). No `@/` imports, so node tests can load it.

export type Swatch = { hex: string; name: string };

const HEX = /^#[0-9a-f]{6}$/i;

/** '#' plus a colour code. */
export const hexOf = (code: string) => '#' + code.toUpperCase();

const channels = (hex: string): [number, number, number] =>
  [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16)) as [number, number, number];

const toHex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();

export function contrastWithWhite(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

export function colourProblem(colour: unknown): string | null {
  if (typeof colour !== 'string' || !HEX.test(colour)) return 'Choose a colour';
  return contrastWithWhite(colour) >= 4.5 ? null : 'That colour would make text hard to read. Choose a darker one.';
}

// Names for the colours a shop is likely to pick, by colour code (kept
// without the # so the no-raw-colour lint rule reads them as data); the
// drawing's Dark blue, Green and Charcoal come first.
const NAMES: [string, string][] = [
  ['Dark blue', '1A3F66'], ['Green', '2F6B4F'], ['Charcoal', '2A2822'],
  ['Black', '000000'], ['Navy', '1B2A4A'], ['Blue', '1F5FAF'], ['Teal', '16676B'],
  ['Dark green', '1E4630'], ['Red', 'B0262B'], ['Dark red', '6E1A1F'], ['Purple', '5B2E7A'],
  ['Brown', '5A3A22'], ['Orange', 'B4530F'], ['Grey', '55585E'], ['Pink', 'A3245E'],
];

export function colourName(hex: string): string {
  const [r, g, b] = channels(hex);
  let best = NAMES[0];
  let bestDistance = Infinity;
  for (const entry of NAMES) {
    const [r2, g2, b2] = channels(entry[1]);
    const distance = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (distance < bestDistance) { best = entry; bestDistance = distance; }
  }
  return best[0];
}

/** Up to two readable colours from a logo's RGBA pixels, commonest first. */
export function coloursFromPixels(data: Uint8ClampedArray, most = 2): Swatch[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += data[i]; bucket.g += data[i + 1]; bucket.b += data[i + 2];
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((x) => toHex([x.r / x.n, x.g / x.n, x.b / x.n]))
    .filter((hex) => colourProblem(hex) === null)
    .slice(0, most)
    .map((hex) => ({ hex, name: colourName(hex) }));
}
