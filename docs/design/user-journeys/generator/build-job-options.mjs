// Builds the job-page design exploration (out-job-options/project/*) from
// job-options.mjs. Separate from build.mjs/build-diary.mjs: does not touch
// out/ or out-diary/.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { boards } from './job-options.mjs';
import { DW, DH } from './stage1.mjs';
import { FONT_LINK } from './ui.mjs';

const here = new URL('./', import.meta.url).pathname;
const root = here + 'out-job-options/';
rmSync(root, { recursive: true, force: true });
mkdirSync(root + 'project', { recursive: true });

const FONT = "'Work Sans', ui-sans-serif, system-ui, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Same .dc.html shape build-diary.mjs's page() writes: the support.js head
// line, the <x-dc>/<helmet> wrapper, the data-dc-script block, $preview
// equal to the board size.
function page(title, w, h, body) {
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
<link rel="stylesheet" href="${FONT_LINK.replace(/&/g, '&amp;')}">
<style>
body,button,input,select,textarea{font-family:${FONT}}
body{margin:0;color:#1c1e19;background:#f3f2ee}
a{color:#3f4d33}a:hover{color:#1c1e19}
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

const written = [];
for (const b of boards) {
  const file = `${b.id}.dc.html`;
  writeFileSync(root + 'project/' + file, page(b.title, DW, DH, b.html));
  written.push({ id: b.id, title: b.title, w: DW, h: DH, file });
}
writeFileSync(root + 'project/boards.json', JSON.stringify(written, null, 1));

console.log(JSON.stringify({ boards: written.length, files: written.map((w) => w.file) }, null, 1));
