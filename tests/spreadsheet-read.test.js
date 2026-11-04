// Reading a spreadsheet someone drops in (openspec/changes/citrus-import-products,
// design 1): Excel and CSV, and anything else, or anything that unpacks far too
// large, refused without stopping the server. Made-up files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSpreadsheet, CantRead } from '../server/lib/spreadsheet-read.js';
import { xlsxOf, zipOf } from './helpers/xlsx.js';

test('an Excel file comes back row by row, with its numbers, words and gaps in place', () => {
  const rows = readSpreadsheet(xlsxOf([['Report title'], ['Code', 'Name', null, 'Price'], ['B05S-RX', 'Shimano brake pads & co', null, 28.5]]), 'a.xlsx');
  assert.deepEqual(rows, [['Report title'], ['Code', 'Name', '', 'Price'], ['B05S-RX', 'Shimano brake pads & co', '', '28.5']]);
});

test('Excel words held in pieces, typed in place, or as a formula result all read', () => {
  const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>In place</t></is></c><c r="C1" t="str"><f>A1</f><v>Formula</v></c><c r="AA1"><v>7</v></c></row></sheetData></worksheet>';
  const file = zipOf({
    'xl/sharedStrings.xml': '<sst><si><r><t>Two </t></r><r><t>pieces</t></r><rPh><t>skip</t></rPh></si></sst>',
    'xl/worksheets/sheet1.xml': sheet,
  });
  const [row] = readSpreadsheet(file, 'a.xlsx');
  assert.deepEqual([row[0], row[1], row[2], row[26]], ['Two pieces', 'In place', 'Formula', '7']);
});

test('a CSV reads, with its quotes, commas and a starting mark', () => {
  const rows = readSpreadsheet(Buffer.from('﻿Code,Name\r\nB05S-RX,"Pads, ""Shimano"""\r\n'), 'a.csv');
  assert.deepEqual(rows, [['Code', 'Name'], ['B05S-RX', 'Pads, "Shimano"']]);
});

test('anything else can\'t be read: an old Excel file, a picture, a broken zip, words called .xlsx', () => {
  const oldExcel = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
  assert.throws(() => readSpreadsheet(oldExcel, 'a.xls'), CantRead);
  assert.throws(() => readSpreadsheet(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'a.png'), CantRead);
  assert.throws(() => readSpreadsheet(Buffer.from('PK\x03\x04 not really a zip'), 'a.xlsx'), CantRead);
  assert.throws(() => readSpreadsheet(Buffer.from('hello'), 'a.xlsx'), CantRead);
  assert.throws(() => readSpreadsheet(zipOf({ 'readme.txt': 'no sheet here' }), 'a.xlsx'), CantRead);
});

test('a small file that unpacks far too large is refused, not unpacked', () => {
  const huge = zipOf({ 'xl/worksheets/sheet1.xml': Buffer.alloc(300 * 1024 * 1024, 0x20) });
  assert.ok(huge.length < 2 * 1024 * 1024, 'the file itself is small');
  assert.throws(() => readSpreadsheet(huge, 'a.xlsx'), CantRead);
});
