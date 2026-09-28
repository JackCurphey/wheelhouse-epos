// Builds the look-options design exploration (out-looks/project/*) from
// looks.mjs. Separate from build.mjs/build-diary.mjs/build-job-options.mjs:
// does not touch out/, out-diary/ or out-job-options/.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { LOOKS, buildLook, buildIntro } from './looks.mjs';

const here = new URL('./', import.meta.url).pathname;
const root = here + 'out-looks/';
rmSync(root, { recursive: true, force: true });
mkdirSync(root + 'project', { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Same .dc.html shape build-diary.mjs's / build-job-options.mjs's page()
// write: the support.js head line, the <x-dc>/<helmet> wrapper, the
// data-dc-script block, $preview equal to the board size. Each board's own
// Google Fonts css2 link goes in <helmet> (per-look fonts — brief).
function page(title, w, h, body, fontLink) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="${fontLink.replace(/&/g, '&amp;')}">
<style>
body{margin:0}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

const boards = [...LOOKS.map(buildLook), buildIntro()];
const written = [];
for (const b of boards) {
  const file = `${b.id}.dc.html`;
  writeFileSync(root + 'project/' + file, page(b.title, b.w, b.h, b.html, b.fontLink));
  written.push({ id: b.id, title: b.title, w: b.w, h: b.h });
}
writeFileSync(root + 'boards.json', JSON.stringify(written, null, 1));

console.log(JSON.stringify({ boards: written.length, files: written.map((w) => `${w.id}.dc.html`) }, null, 1));
