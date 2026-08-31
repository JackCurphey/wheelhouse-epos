// Fails if the checked-in registry payloads under public/r are not what
// `shadcn build` would produce from the current source files.
//
// Why this exists: shadcn components are not a dependency, they are ordinary
// editable files in src/components/ui. That is the point of shadcn, but it
// means someone can hand-edit a component, ship it, and never rebuild the
// registry - after which public/r is advisory fiction, and anyone consuming
// the registry gets a different component from the one this repo actually
// renders. Nothing about that failure is visible at review time.
//
// Why not the CLI's own diff: shadcn 4.19.1 exposes `add <component> --diff`
// (the old `shadcn diff` is deprecated) and `add --dry-run`. Both compare a
// LOCAL project against a REMOTE registry it can fetch over HTTP, and both
// operate one component at a time. This project's registry is declared in
// components.json as "@wheelhouse": "/r/{name}.json" - a relative URL with no
// host - so there is nothing for the CLI to fetch without standing up a
// server in CI, and even then it would answer the wrong question: it would
// compare the components against the stale registry rather than telling us
// the registry is stale. Rebuilding and comparing byte-for-byte is the
// direction that actually catches drift, so that is what this does.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const registryFile = path.join(repoRoot, 'registry', 'registry.json');
const committedDir = path.join(repoRoot, 'public', 'r');

function fail(message) {
  console.error(`Registry drift check FAILED\n\n${message}`);
  process.exit(1);
}

if (!existsSync(registryFile)) {
  fail(
    'registry/registry.json is missing.\n' +
      'The registry is what publishes these components; it is not optional.',
  );
}

// Drift detection compares committed output against a fresh build, so it is
// only meaningful if the output IS committed. If .gitignore treats public/r
// as a disposable build artifact there is nothing to compare and this gate
// would pass vacuously on every run - which is worse than not having it, so
// it fails loudly instead of pretending to guard something.
const relCommitted = path.relative(repoRoot, committedDir);
const ignored = spawnSync('git', ['check-ignore', '-q', path.join(committedDir, 'probe.json')], {
  cwd: repoRoot,
});
if (ignored.status === 0) {
  fail(
    `${relCommitted} is listed in .gitignore, so there is no committed registry ` +
      'output to compare a fresh build against.\n' +
      'Either commit the built registry (remove the ignore rule and run ' +
      '`npm run registry:build`), or drop this step from the workflow - but do ' +
      'not leave it in place answering nothing.',
  );
}

if (!existsSync(committedDir)) {
  fail(
    `${relCommitted} is missing.\n` + 'Run `npm run registry:build` and commit the result.',
  );
}

const buildDir = mkdtempSync(path.join(tmpdir(), 'registry-drift-'));

try {
  // Same entrypoint as `npm run registry:build`, only pointed somewhere
  // disposable, so this check can never "fix" the drift it is meant to
  // report by overwriting the committed output.
  const build = spawnSync(
    'npx',
    ['--no-install', 'shadcn', 'build', 'registry/registry.json', '--output', buildDir],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

  if (build.error) fail(`Could not run \`shadcn build\`: ${build.error.message}`);
  if (build.status !== 0) {
    fail(
      `\`shadcn build\` exited ${build.status}.\n\n` +
        `${build.stdout ?? ''}${build.stderr ?? ''}`.trim(),
    );
  }

  const listJson = (dir) => {
    const out = [];
    const walk = (current, prefix) => {
      for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const abs = path.join(current, entry.name);
        if (entry.isDirectory()) walk(abs, rel);
        else if (entry.isFile() && entry.name.endsWith('.json')) out.push(rel);
      }
    };
    if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir, '');
    return out;
  };

  const freshFiles = listJson(buildDir);
  const committedFiles = listJson(committedDir);

  if (freshFiles.length === 0) {
    fail('`shadcn build` produced no registry files. Is registry.json empty?');
  }

  const missing = freshFiles.filter((f) => !committedFiles.includes(f));
  const extra = committedFiles.filter((f) => !freshFiles.includes(f));
  const changed = [];

  for (const file of freshFiles) {
    if (missing.includes(file)) continue;
    const fresh = readFileSync(path.join(buildDir, file), 'utf8');
    const committed = readFileSync(path.join(committedDir, file), 'utf8');
    if (fresh !== committed) changed.push(file);
  }

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log(
      `Registry drift check OK - ${freshFiles.length} file(s) in ` +
        `${path.relative(repoRoot, committedDir)} match a fresh \`shadcn build\`.`,
    );
    process.exit(0);
  }

  const report = [];
  if (missing.length > 0) {
    report.push(`Not committed (a build produces them, the repo does not have them):\n  ${missing.join('\n  ')}`);
  }
  if (extra.length > 0) {
    report.push(`Stale (committed, but no longer produced by a build):\n  ${extra.join('\n  ')}`);
  }
  if (changed.length > 0) {
    report.push(`Out of date (committed content differs from a fresh build):\n  ${changed.join('\n  ')}`);
    for (const file of changed) {
      const diff = spawnSync(
        'diff',
        ['-u', '--label', `committed/${file}`, '--label', `rebuilt/${file}`,
          path.join(committedDir, file), path.join(buildDir, file)],
        { encoding: 'utf8' },
      );
      if (diff.stdout) report.push(diff.stdout.trimEnd());
    }
  }

  report.push(
    'A component was almost certainly hand-edited without rebuilding the ' +
      'registry.\nRun `npm run registry:build` and commit ' +
      `${path.relative(repoRoot, committedDir)}.`,
  );

  fail(report.join('\n\n'));
} finally {
  rmSync(buildDir, { recursive: true, force: true });
}
