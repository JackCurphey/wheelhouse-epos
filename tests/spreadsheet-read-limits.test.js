// The independent review's files: tiny, and made up, each of which froze or
// killed the server when read on its own thread (openspec/changes/citrus-import-products,
// design 1). Each must now be refused, quickly, with the server left answering.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { readSpreadsheet, CantRead } from '../server/lib/spreadsheet-read.js';
import { readInWorker, ReadBusy } from '../server/lib/read-in-worker.js';
import { recognise } from '../server/move/citrus-files.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { xlsxOf, zipOf } from './helpers/xlsx.js';

const sheetOf = (sheet, shared) => zipOf({ 'xl/worksheets/sheet1.xml': sheet, ...(shared === undefined ? {} : { 'xl/sharedStrings.xml': shared }) });
const UNCLOSED_ROWS = sheetOf(`<worksheet><sheetData>${'<row>'.repeat(2_000_000)}`);
const UNCLOSED_WORDS = sheetOf('<worksheet><sheetData></sheetData></worksheet>', `<sst>${'<si>'.repeat(2_000_000)}`);
const FAR_COLUMN = sheetOf(`<worksheet><sheetData>${'<row><c r="ALL1"><v>1</v></c></row>'.repeat(290_000)}</sheetData></worksheet>`);
const HUGE_WORD_MANY_TIMES = sheetOf(`<worksheet><sheetData>${'<row><c r="A1" t="s"><v>0</v></c></row>'.repeat(2000)}</sheetData></worksheet>`, `<sst><si><t>${'x'.repeat(1024 * 1024)}</t></si></sst>`);
const ALLOWED_WORD_TOO_OFTEN = sheetOf(`<worksheet><sheetData>${'<row><c r="A1" t="s"><v>0</v></c></row>'.repeat(290_000)}${'<row><c r="A1" t="s"><v>0</v></c></row>'}</sheetData></worksheet>`, `<sst><si><t>${'x'.repeat(32_000)}</t></si></sst>`);
const ALL = { UNCLOSED_ROWS, UNCLOSED_WORDS, FAR_COLUMN, HUGE_WORD_MANY_TIMES, ALLOWED_WORD_TOO_OFTEN };

test('each is tiny, and read straight through it\'s refused within a few seconds', () => {
  for (const [name, file] of Object.entries(ALL)) {
    assert.ok(file.length < 1024 * 1024, `${name} is small: ${file.length}`);
    const started = Date.now();
    assert.throws(() => readSpreadsheet(file, 'a.xlsx'), CantRead, name);
    assert.ok(Date.now() - started < 8000, `${name} took ${Date.now() - started}ms`);
  }
});

test('a character that doesn\'t exist can\'t be read; half a character is cleaned, so it can be stored', () => {
  const cell = (text) => sheetOf(`<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row></sheetData></worksheet>`);
  assert.throws(() => readSpreadsheet(cell('&#x110000;'), 'a.xlsx'), CantRead);
  assert.throws(() => readSpreadsheet(cell('&#99999999;'), 'a.xlsx'), CantRead);
  const found = recognise([['Alias', 'ILC'], [`a\ud800b`, 'B05S-RX']]);
  assert.equal(JSON.parse(found.rows[0]).Alias, 'a�b');
});

test('a cell far to the right can\'t be read, even only one', () => {
  assert.throws(() => readSpreadsheet(sheetOf('<worksheet><sheetData><row><c r="XFD1"><v>1</v></c></row></sheetData></worksheet>'), 'a.xlsx'), CantRead);
});

test('a cell over Excel\'s own limit can\'t be read, in Excel or CSV', () => {
  const long = 'x'.repeat(32_768);
  assert.throws(() => readSpreadsheet(xlsxOf([[long]]), 'a.xlsx'), CantRead);
  assert.throws(() => readSpreadsheet(Buffer.from(`${long}\n`), 'a.csv'), CantRead);
  assert.equal(readSpreadsheet(xlsxOf([['x'.repeat(32_767)]]), 'a.xlsx')[0][0].length, 32_767);
});

test('in a worker: a good file reads, a bad one is null, one that runs out of time or memory is null', async () => {
  const good = await readInWorker(xlsxOf([['Alias', 'ILC'], ['4524667000001', 'B05S-RX']]), 'a.xlsx');
  assert.deepEqual({ report: good.report, rows: good.rows }, { report: 'barcodes', rows: ['{"Alias":"4524667000001","ILC":"B05S-RX"}'] });
  assert.equal(await readInWorker(UNCLOSED_ROWS, 'a.xlsx'), null);
  assert.equal(await readInWorker(Buffer.from('hello'), 'a.xlsx'), null);
  assert.equal(await readInWorker(xlsxOf([['Alias', 'ILC'], ['1', '2']]), 'a.xlsx', { timeLimitMs: 0 }), null, 'time');
  const big = xlsxOf([['Alias', 'ILC'], ...Array.from({ length: 60_000 }, (_, i) => [`${'word'.repeat(20)}${i}`, `CODE-${i}`])]);
  assert.equal((await readInWorker(big, 'a.xlsx')).rows.length, 60_000, 'it reads with room to do so');
  const logged = [];
  const realError = console.error;
  console.error = (...args) => { logged.push(args.join(' ')); };
  try {
    assert.equal(await readInWorker(big, 'secret name.xlsx', { memoryMb: 4 }), null, 'memory');
  } finally {
    console.error = realError;
  }
  assert.deepEqual(logged, ['Move: reading a file failed ERR_WORKER_OUT_OF_MEMORY'], 'the code, and nothing of the file');
});

test('one read at a time: a second is refused politely, and the next one after is fine', async () => {
  const first = readInWorker(xlsxOf([['Alias', 'ILC'], ['1', '2']]), 'a.xlsx');
  await assert.rejects(readInWorker(xlsxOf([['Alias', 'ILC'], ['1', '2']]), 'a.xlsx'), ReadBusy);
  assert.equal((await first).report, 'barcodes');
  assert.equal((await readInWorker(xlsxOf([['Alias', 'ILC'], ['1', '2']]), 'a.xlsx')).report, 'barcodes');
});

let server;
let owner;
before(async () => {
  server = await startLiveServer({ env: { WH_MOVE_TICK_MS: '50' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
});
after(async () => {
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
    await pool.end();
  }
});

test('the server keeps answering while each is read, and tells the Owner it can\'t be read', async () => {
  const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
  for (const [name, file] of Object.entries(ALL)) {
    const res = await staff('/api/move/files', { method: 'POST', body: { fileName: `${name}.xlsx`, dataBase64: file.toString('base64'), requestKey: randomBytes(24).toString('hex') } });
    assert.equal(res.status, 202, `${name}: ${JSON.stringify(res.body)}`);
    let state = res.body.state;
    let slowest = 0;
    const started = Date.now();
    while (state === 'reading') {
      assert.ok(Date.now() - started < 80_000, `${name} never finished`);
      const asked = Date.now();
      const health = await fetch(`${server.baseUrl}/healthz`);
      assert.ok(health.status < 600);
      slowest = Math.max(slowest, Date.now() - asked);
      state = (await staff('/api/move')).body.files.find((f) => f.id === res.body.id).state;
      await new Promise((r) => { setTimeout(r, 50); });
    }
    assert.equal(state, 'cant_read', name);
    assert.ok(slowest < 2000, `${name}: the server took ${slowest}ms to answer`);
    const held = await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM move_file_bytes WHERE file_id = ?').get(res.body.id));
    assert.equal(held.n, 0, 'the file itself has gone');
  }
});
