// Reading a spreadsheet someone drops in: Excel's .xlsx (a zip of XML) and CSV
// (openspec/changes/citrus-import-products, design 1). Comes back as rows of
// text cells. No dependency: `zlib` unpacks each part with a limit, so a small
// file can't unpack to something that stops the server, and the XML is only
// matched, never parsed with entities or outside references.
import { inflateRawSync } from 'node:zlib';

export class CantRead extends Error {}

const MAX_PART_BYTES = 200 * 1024 * 1024;
const MAX_ROWS = 300_000;

// The parts of a zip, by name, each unpacked when asked for.
function zipParts(buf) {
  const END = 0x06054b50;
  let end = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i -= 1) {
    if (buf.readUInt32LE(i) === END) { end = i; break; }
  }
  if (end < 0) throw new CantRead('Not a zip');
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const parts = new Map();
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== 0x02014b50) throw new CantRead('Broken zip');
    const method = buf.readUInt16LE(at + 10);
    const packedSize = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    parts.set(buf.toString('utf8', at + 46, at + 46 + nameLen), { method, packedSize, localAt });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return (name) => {
    const part = parts.get(name);
    if (!part) return null;
    const { method, packedSize, localAt } = part;
    if (localAt + 30 > buf.length || buf.readUInt32LE(localAt) !== 0x04034b50) throw new CantRead('Broken zip');
    const start = localAt + 30 + buf.readUInt16LE(localAt + 26) + buf.readUInt16LE(localAt + 28);
    const packed = buf.subarray(start, start + packedSize);
    if (method === 0) return packed.toString('utf8');
    if (method !== 8) throw new CantRead('Unknown packing');
    try {
      return inflateRawSync(packed, { maxOutputLength: MAX_PART_BYTES }).toString('utf8');
    } catch {
      throw new CantRead('Won’t unpack');
    }
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescapeXml = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g, (all, dec, hex, name) => {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  return ENTITIES[name] ?? all;
});
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

const columnIndex = (ref) => {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? '') n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};

function readXlsx(buf) {
  const part = zipParts(buf);
  // The first sheet the workbook lists; a file from a simpler writer may only have sheet1.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = part('xl/workbook.xml');
  const rels = part('xl/_rels/workbook.xml.rels');
  const firstId = workbook && /<sheet\s[^>]*r:id="([^"]+)"/.exec(workbook)?.[1];
  if (firstId && rels) {
    for (const [tag] of rels.matchAll(/<Relationship\s[^>]*>/g)) {
      if (tag.includes(`Id="${firstId}"`)) {
        const target = /Target="([^"]+)"/.exec(tag)?.[1];
        if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      }
    }
  }
  const sheet = part(sheetPath);
  if (sheet === null) throw new CantRead('No sheet');
  const sharedXml = part('xl/sharedStrings.xml') ?? '';
  // A word's phonetic hint (<rPh>) isn't part of the word.
  const shared = [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')));
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= MAX_ROWS) throw new CantRead('Too many rows');
    const row = [];
    for (const cell of rowMatch[1].matchAll(/<c((?:\s[^>]*?)?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? '';
      const type = /\st="([^"]+)"/.exec(attrs)?.[1];
      const ref = /\sr="([^"]+)"/.exec(attrs)?.[1];
      const value = /<v>([^<]*)<\/v>/.exec(body)?.[1] ?? '';
      const text = type === 's' ? shared[Number(value)] ?? '' : type === 'inlineStr' ? textOf(body) : unescapeXml(value);
      const at = ref ? columnIndex(ref) : row.length;
      if (at < 0 || at > 1000) throw new CantRead('Odd cell');
      while (row.length < at) row.push('');
      row[at] = text;
    }
    rows.push(row);
  }
  return rows;
}

function readCsv(buf) {
  const text = buf.toString('utf8').replace(/^﻿/, '');
  if (text.includes('\u0000')) throw new CantRead('Not text');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      if (rows.length > MAX_ROWS) throw new CantRead('Too many rows');
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

/** @returns {string[][]} the first sheet's rows. Throws CantRead for anything else. */
export function readSpreadsheet(buf, fileName = '') {
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) return readXlsx(buf);
  if (/\.csv$/i.test(fileName)) return readCsv(buf);
  throw new CantRead('Not a spreadsheet');
}
