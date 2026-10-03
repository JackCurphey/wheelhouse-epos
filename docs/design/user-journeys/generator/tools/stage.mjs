// Stages a journey's own canvas build for publishing with the Artifact tool.
//   node tools/stage.mjs <live canvas.json> <out-<name>-sand/project> <stage-dir> [file ...]
// Copies the build to <stage-dir>/project and writes canvas.json with the
// BUILD's layout, keeping the live index's extra keys, createdOnFiles and
// note widths. Use it only when nobody has moved boards by hand on the live
// canvas (it prints boards whose position differs — check that list). Prints
// the publish `files` map: the named files (or every board if none are
// named, plus any board new to the canvas), and null for boards the build
// dropped.
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync } from 'node:fs';
const [live, built, stage, ...only] = process.argv.slice(2);
rmSync(stage, { recursive: true, force: true }); cpSync(built, stage + '/project', { recursive: true });
const L = JSON.parse(readFileSync(live)), B = JSON.parse(readFileSync(built + '/canvas.json'));
for (const k of Object.keys(L)) if (!(k in B)) B[k] = L[k];
B.createdOnFiles = L.createdOnFiles;
for (const [k, n] of Object.entries(B.notes)) if (L.notes?.[k]?.w) n.w = L.notes[k].w;
writeFileSync(stage + '/project/canvas.json', JSON.stringify(B, null, 2));
const moved = Object.keys(L.boards).filter((k) => B.boards[k] && (B.boards[k].x !== L.boards[k].x || B.boards[k].y !== L.boards[k].y));
const files = {};
for (const f of readdirSync(stage + '/project')) if (f !== 'canvas.json' && (!only.length || only.includes(f) || !L.boards[f])) files['project/' + f] = 'project/' + f;
for (const k of Object.keys(L.boards)) if (!B.boards[k]) files['project/' + k] = null;
console.error('boards that sit elsewhere in the new layout:', moved.join(', ') || 'none');
console.log(JSON.stringify(files));
