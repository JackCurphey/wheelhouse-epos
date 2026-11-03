// The worker thread behind read-in-worker.js: reads the file and recognises it.
import { parentPort, workerData } from 'node:worker_threads';
import { readSpreadsheet } from '../lib/spreadsheet-read.js';
import { recognise } from './citrus-files.js';

let result = null;
try {
  const { bytes, fileName } = workerData;
  result = recognise(readSpreadsheet(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), fileName));
} catch {
  result = null; // can't read it, whatever the reason; no row content goes anywhere
}
parentPort.postMessage(result);
