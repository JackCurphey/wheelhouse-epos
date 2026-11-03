// Reading a spreadsheet someone drops in: Excel's .xlsx (a zip of XML) and CSV
// (openspec/changes/citrus-import-products, design 1). Comes back as rows of
// text cells. No dependency: `zlib` unpacks each part with a limit, and the XML
// is scanned straight through, once, never parsed with entities or outside
// references. Every size is capped, as a tiny file can unpack to a huge one.
// It runs in a worker with its own limits (read-in-worker.js), never on the
// server's own thread.
import { inflateRawSync } from 'node:zlib';

export class CantRead extends Error {}

const MAX_PART_BYTES = 200 * 1024 * 1024;
const MAX_ROWS = 300_000;
const MAX_CELLS = 5_000_000; // gaps between cells count too
const MAX_COLUMN = 300;
const MAX_CELL_CHARS = 32_767; // Excel's own limit
const MAX_TOTAL_CHARS = 150_000_000;
const MAX_OPEN_TAG = 2_000;

// What a file has used so far: one shared word in many cells counts each time.
function newBudget() {
  let cells = 0;
  let chars = 0;
  return (text, gaps = 0) => {
    cells += 1 + gaps;
    chars += text.length;
    if (text.length > MAX_CELL_CHARS || cells > MAX_CELLS || chars > MAX_TOTAL_CHARS) throw new CantRead('Too large');
  };
}

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
function unescapeXml(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(?:#(\d{1,8})|#x([0-9a-fA-F]{1,8})|(\w{1,8}));/g, (all, dec, hex, name) => {
    if (name) return ENTITIES[name] ?? all;
    try {
      return String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16));
    } catch {
      throw new CantRead('A character that doesn’t exist');
    }
  });
}

// Each <tag>…</tag> or <tag/> in order, going forward only, so the time taken
// follows the file's size whatever is in it. An opening tag with no closing
// tag is a broken file.
function* elements(xml, tag) {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let at = xml.indexOf(open);
  while (at >= 0) {
    const next = xml[at + open.length];
    if (next !== ' ' && next !== '>' && next !== '/' && next !== '\t' && next !== '\n' && next !== '\r') {
      at = xml.indexOf(open, at + open.length);
      continue;
    }
    const end = xml.indexOf('>', at);
    if (end < 0 || end - at > MAX_OPEN_TAG) throw new CantRead('Broken XML');
    const attrs = xml.slice(at + open.length, end);
    if (xml[end - 1] === '/') {
      yield { attrs, body: '' };
      at = xml.indexOf(open, end);
    } else {
      const shut = xml.indexOf(close, end);
      if (shut < 0) throw new CantRead('Broken XML');
      yield { attrs, body: xml.slice(end + 1, shut) };
      at = xml.indexOf(open, shut + close.length);
    }
  }
}
// Opening tags are capped in length, so a pattern over one stays quick.
const attrOf = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];

function textOf(xml) {
  let out = '';
  for (const { body } of elements(xml, 't')) out += unescapeXml(body);
  return out;
}
// A word's phonetic hint (<rPh>) isn't part of the word.
function withoutPhonetics(xml) {
  let out = '';
  let from = 0;
  for (;;) {
    const at = xml.indexOf('<rPh', from);
    if (at < 0) return out + xml.slice(from);
    out += xml.slice(from, at);
    const shut = xml.indexOf('</rPh>', at);
    if (shut < 0) throw new CantRead('Broken XML');
    from = shut + 6;
  }
}

const columnIndex = (ref) => {
  let n = 0;
  for (let i = 0; i < ref.length; i += 1) {
    const code = ref.charCodeAt(i);
    if (code < 65 || code > 90) break;
    n = n * 26 + code - 64;
    if (n > MAX_COLUMN) return n;
  }
  return n - 1;
};

function readXlsx(buf) {
  const part = zipParts(buf);
  // The first sheet the workbook lists; a file from a simpler writer may only have sheet1.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = part('xl/workbook.xml');
  const rels = part('xl/_rels/workbook.xml.rels');
  let firstId;
  if (workbook) for (const { attrs } of elements(workbook, 'sheet')) { firstId = attrOf(attrs, 'r:id'); break; }
  if (firstId && rels) {
    for (const { attrs } of elements(rels, 'Relationship')) {
      if (attrOf(attrs, 'Id') === firstId) {
        const target = attrOf(attrs, 'Target');
        if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      }
    }
  }
  const sheet = part(sheetPath);
  if (sheet === null) throw new CantRead('No sheet');
  const spend = newBudget();
  const shared = [];
  const sharedXml = part('xl/sharedStrings.xml');
  if (sharedXml) {
    for (const { body } of elements(sharedXml, 'si')) {
      const word = textOf(withoutPhonetics(body));
      if (word.length > MAX_CELL_CHARS || shared.length >= MAX_CELLS) throw new CantRead('Too large');
      shared.push(word);
    }
  }
  const rows = [];
  for (const { body: rowXml } of elements(sheet, 'row')) {
    if (rows.length >= MAX_ROWS) throw new CantRead('Too many rows');
    const row = [];
    for (const { attrs, body } of elements(rowXml, 'c')) {
      const type = attrOf(attrs, 't');
      const ref = attrOf(attrs, 'r');
      let text;
      if (type === 'inlineStr') text = textOf(body);
      else {
        const start = body.indexOf('<v>');
        const end = start < 0 ? -1 : body.indexOf('</v>', start);
        const value = end < 0 ? '' : body.slice(start + 3, end);
        text = type === 's' ? shared[Number(value)] ?? '' : unescapeXml(value);
      }
      const at = ref ? columnIndex(ref) : row.length;
      if (at < 0 || at >= MAX_COLUMN) throw new CantRead('Odd cell');
      const gaps = Math.max(0, at - row.length);
      spend(text, gaps);
      for (let i = 0; i < gaps; i += 1) row.push('');
      row[at] = text;
    }
    rows.push(row);
  }
  return rows;
}

function readCsv(buf) {
  const text = buf.toString('utf8').replace(/^﻿/, '');
  if (text.includes('\u0000')) throw new CantRead('Not text');
  const spend = newBudget();
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const endCell = (value) => { spend(value); row.push(value); };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') { endCell(cell); cell = ''; }
    else if (ch === '\n') {
      endCell(cell.replace(/\r$/, ''));
      rows.push(row);
      if (rows.length > MAX_ROWS) throw new CantRead('Too many rows');
      row = [];
      cell = '';
    } else cell += ch;
    if (cell.length > MAX_CELL_CHARS + 1) throw new CantRead('Too large');
  }
  if (cell !== '' || row.length) { endCell(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

/** @returns {string[][]} the first sheet's rows. Throws CantRead for anything else. */
export function readSpreadsheet(buf, fileName = '') {
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) return readXlsx(buf);
  if (/\.csv$/i.test(fileName)) return readCsv(buf);
  throw new CantRead('Not a spreadsheet');
}
