// Reads a dropped file in a worker thread with limits of its own, so no file,
// however odd, can hold up or stop the server for other shops
// (openspec/changes/citrus-import-products, design 1). One read at a time per
// server; a worker that fails or runs out of time means "can't read".
import { Worker } from 'node:worker_threads';

export class ReadBusy extends Error {}
const TIME_LIMIT_MS = 60_000;
const MEMORY_MB = 1024;
const WORKER = new URL('../move/read-worker.js', import.meta.url);
let reading = false;

/**
 * @returns {Promise<{ report: string, rows: string[], storeName: string } | null>}
 * null when it can't be read. Rejects with ReadBusy while another read is under way.
 */
export function readInWorker(bytes, fileName, { timeLimitMs = TIME_LIMIT_MS, memoryMb = MEMORY_MB } = {}) {
  if (reading) return Promise.reject(new ReadBusy());
  reading = true;
  return new Promise((resolve) => {
    const copy = new Uint8Array(bytes);
    const worker = new Worker(WORKER, {
      workerData: { bytes: copy, fileName },
      transferList: [copy.buffer],
      resourceLimits: { maxOldGenerationSizeMb: memoryMb, maxYoungGenerationSizeMb: Math.min(64, memoryMb), stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reading = false;
      resolve(result);
      void worker.terminate();
    };
    const timer = setTimeout(() => finish(null), timeLimitMs);
    worker.once('message', (result) => finish(result));
    // Out of memory or anything else: the file can't be read. Only the error's
    // code is logged, as its message could quote the file.
    worker.once('error', (err) => {
      console.error('Move: reading a file failed', err.code ?? err.name);
      finish(null);
    });
    worker.once('exit', () => finish(null));
  });
}
