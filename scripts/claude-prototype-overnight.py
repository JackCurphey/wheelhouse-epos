#!/usr/bin/env python3
"""Bounded, fresh-session Claude Code loop. Does not run until invoked explicitly."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tarfile
import time

ROOT = Path(__file__).resolve().parents[1]
SPEC = Path('docs/reviews/2026-09-08-workshop-prototype-decisions.md')
BRIEF = Path('docs/reviews/2026-09-08-claude-prototype-overnight-prompt.md')
SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {
        'status': {'type': 'string', 'enum': ['continue', 'complete', 'blocked']},
        'summary': {'type': 'string'},
        'remaining': {'type': 'array', 'items': {'type': 'string'}},
        'blockers': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['status', 'summary', 'remaining', 'blockers'],
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def usage_of(result):
    usage = result.get('usage')
    if not isinstance(usage, dict) or 'input_tokens' not in usage or 'output_tokens' not in usage:
        raise ValueError('No complete usage report; stopping rather than losing budget accounting.')
    keys = ('input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens')
    counts = {k: usage.get(k, 0) for k in keys}
    if any(not isinstance(v, (int, float)) or v < 0 for v in counts.values()):
        raise ValueError('Invalid usage values.')
    # Cache reads are logged separately. This is a working allowance, not billing tokens.
    counts['working_tokens'] = sum(counts[k] for k in keys[:3])
    return counts


def run_command(command, stdout, stderr, timeout, prompt=None):
    """Bound process and its local children; retain logs even on timeout/interrupt."""
    with stdout.open('w') as out, stderr.open('w') as err:
        process = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.PIPE if prompt else subprocess.DEVNULL,
                                   stdout=out, stderr=err, text=True, start_new_session=True)
        try:
            process.communicate(input=prompt, timeout=max(1, timeout))
            return process.returncode
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=10)
            except ProcessLookupError:
                pass
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise


def baseline(run_dir):
    # Include untracked prototype work; git-only snapshots would silently lose it.
    with tarfile.open(run_dir / 'baseline.tar.gz', 'w:gz') as archive:
        for base in [ROOT / 'prototype', ROOT / 'docs/reviews', ROOT / 'scripts']:
            for path in base.rglob('*'):
                if any(part in {'node_modules', 'dist', 'test-results', 'playwright-report', '__pycache__', 'uploads'} for part in path.parts):
                    continue
                if path.name == '.env' or path.name.startswith('.env.'):
                    continue
                if path.is_file() and not path.is_symlink():
                    archive.add(path, arcname=path.relative_to(ROOT))
        for name in ('README.md', 'package.json', 'package-lock.json'):
            archive.add(ROOT / name, arcname=name)
    status = subprocess.run(['git', 'status', '--short'], cwd=ROOT, text=True, capture_output=True, check=True)
    (run_dir / 'initial-git-status.txt').write_text(status.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hours', type=float, default=8)
    parser.add_argument('--iterations', type=int, default=12)
    parser.add_argument('--turns', type=int, default=30, help='Claude agentic turns per fresh session')
    parser.add_argument('--pass-minutes', type=float, default=40)
    parser.add_argument('--token-budget', type=int, default=200000, help='Soft stop, checked after each pass; excludes cache reads')
    parser.add_argument('--max-usd', type=float, help='Optional overall CLI-reported API cost allowance')
    parser.add_argument('--model', help='Optional Claude model alias; otherwise use configured default')
    parser.add_argument('--dry-run', action='store_true', help='Print configuration; no model call or files written')
    args = parser.parse_args()
    if min(args.hours, args.iterations, args.turns, args.pass_minutes, args.token_budget) <= 0 or (args.max_usd is not None and args.max_usd <= 0):
        parser.error('All limits must be positive.')
    claude = shutil.which('claude')
    if not claude:
        parser.error('Claude Code is not installed or is not on PATH.')
    for path in (SPEC, BRIEF, Path('prototype/package.json')):
        if not (ROOT / path).is_file():
            parser.error(f'Missing {path}; use the working checkout containing the prototype.')
    spec_text, brief_text = (ROOT / SPEC).read_text(), (ROOT / BRIEF).read_text()
    pinned = {str(path): sha(ROOT / path) for path in (SPEC, BRIEF)}
    # Ordinary project/user auth remains available. Plugin/settings auto-loading is
    # omitted for a predictable task; no global config or permission file is changed.
    command = [claude, '-p', '--output-format', 'json', '--json-schema', json.dumps(SCHEMA),
               '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
               '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash',
               '--tools', 'Read,Edit,Write,Glob,Grep,Bash',
               '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
               '--max-turns', str(args.turns)]
    if args.model:
        command += ['--model', args.model]
    if args.dry_run:
        print(json.dumps({'root': str(ROOT), 'pins': pinned, 'limits': vars(args), 'command': command,
                          'note': 'Token stop is between passes, not a hard token cap. No model call made.'}, indent=2))
        return 0
    if os.environ.get('CLAUDECODE'):
        parser.error('Run the driver from a normal terminal, outside a Claude Code session.')
    output = ROOT / '.prototype-overnight'
    output.mkdir(exist_ok=True)
    # A lock prevents two loops editing the same prototype at once.
    lock = output / 'active.lock'
    try:
        lock.mkdir()
    except FileExistsError:
        parser.error(f'{lock} exists. Check the previous run before removing a stale lock.')
    run_dir = output / (time.strftime('%Y%m%d-%H%M%S') + f'-{os.getpid()}')
    run_dir.mkdir()
    (lock / 'pid').write_text(str(os.getpid()))
    (output / 'latest.txt').write_text(str(run_dir) + '\n')
    ledger = {'status': 'running', 'working_tokens': 0, 'cache_read_input_tokens': 0,
              'reported_cost_usd': 0.0, 'pins': pinned, 'passes': []}
    start = time.monotonic()
    deadline = start + args.hours * 3600
    failures = 0
    previous = 'First pass: inspect the implementation, establish the baseline, and tackle the largest acceptance gap.'

    def persist():
        ledger['elapsed_seconds'] = round(time.monotonic() - start)
        (run_dir / 'summary.json').write_text(json.dumps(ledger, indent=2) + '\n')

    try:
        baseline(run_dir)
        (run_dir / 'spec.md').write_text(spec_text)
        (run_dir / 'brief.md').write_text(brief_text)
        print(f'Run directory: {run_dir}\nCtrl+C stops the active pass. No commits or deployments are requested.', flush=True)
        for number in range(1, args.iterations + 1):
            remaining_seconds = deadline - time.monotonic()
            if remaining_seconds <= 0 or ledger['working_tokens'] >= args.token_budget:
                ledger['status'] = 'limit_reached'
                break
            remaining_usd = None if args.max_usd is None else args.max_usd - ledger['reported_cost_usd']
            if remaining_usd is not None and remaining_usd <= 0:
                ledger['status'] = 'cost_limit_reached'
                break
            if any(sha(ROOT / path) != digest for path, digest in pinned.items()):
                ledger['status'] = 'spec_or_brief_changed'
                break
            pass_dir = run_dir / f'pass-{number:02d}'
            pass_dir.mkdir()
            prompt = (brief_text + '\n\n## Driver context\n'
                      + f'Pass {number}/{args.iterations}. Run evidence directory: {pass_dir}\n'
                      + f'Canonical spec SHA-256: {pinned[str(SPEC)]}\n'
                      + f'Remaining working-token allowance before this pass: {args.token_budget - ledger["working_tokens"]}. '
                      + f'This pass has at most {args.turns} agentic turns and {min(args.pass_minutes, remaining_seconds / 60):.1f} minutes. '
                      + 'Update prototype/OVERNIGHT.md early and after each coherent change.\n'
                      + 'Previous pass/verification result:\n' + previous + '\n\n'
                      + '## Verbatim governing specification\n' + spec_text)
            (pass_dir / 'prompt.md').write_text(prompt)
            invocation = list(command)
            if remaining_usd is not None:
                invocation += ['--max-budget-usd', f'{remaining_usd:.6f}']
            print(f'Pass {number}: starting ({ledger["working_tokens"]:,} working tokens used)', flush=True)
            rc = run_command(invocation, pass_dir / 'claude.json', pass_dir / 'claude.stderr.log',
                             min(args.pass_minutes * 60, remaining_seconds), prompt)
            if any(sha(ROOT / path) != digest for path, digest in pinned.items()):
                ledger['status'] = 'spec_or_brief_changed'
                break
            result = json.loads((pass_dir / 'claude.json').read_text())
            counts = usage_of(result)
            cost = result.get('total_cost_usd')
            if not isinstance(cost, (int, float)) or cost < 0:
                raise ValueError('Missing/invalid reported cost; inspect the result before restarting.')
            ledger['working_tokens'] += counts['working_tokens']
            ledger['cache_read_input_tokens'] += counts['cache_read_input_tokens']
            ledger['reported_cost_usd'] += cost
            report = result.get('structured_output') or {}
            record = {'pass': number, 'exit_code': rc, 'usage': counts, 'reported_cost_usd': cost,
                      'report': report, 'directory': str(pass_dir)}
            ledger['passes'].append(record)
            # Run checks independently, even when the agent's report claims they pass.
            check_rc = run_command(['npm', 'run', 'prototype:test'], pass_dir / 'checks.log',
                                   pass_dir / 'checks.stderr.log', min(600, max(1, deadline - time.monotonic())))
            record['checks_exit_code'] = check_rc
            previous = json.dumps(record) + f'\nRead full logs in {pass_dir} before choosing the next action.'
            if rc != 0 or result.get('is_error'):
                failures += 1
            elif report.get('status') == 'blocked':
                ledger['status'] = 'blocked'
                break
            elif report.get('status') == 'complete' and check_rc == 0:
                package = json.loads((ROOT / 'prototype/package.json').read_text())
                if not package.get('scripts', {}).get('test:browser'):
                    previous += '\nCompletion rejected: the real test:browser command is missing.'
                    failures += 1
                else:
                    browser_rc = run_command(['npm', '--prefix', 'prototype', 'run', 'test:browser'],
                                             pass_dir / 'browser.log', pass_dir / 'browser.stderr.log',
                                             min(900, max(1, deadline - time.monotonic())))
                    record['browser_exit_code'] = browser_rc
                    if browser_rc == 0:
                        ledger['status'] = 'complete'
                        break
                    previous += '\nCompletion rejected: browser verification failed; read browser.log and browser.stderr.log.'
                    failures += 1
            elif report.get('status') not in {'continue', 'complete'}:
                previous += '\nNo valid structured status returned. Write checkpoint and return the requested schema.'
                failures += 1
            else:
                failures = failures + 1 if check_rc else 0
            persist()
            if failures >= 3:
                ledger['status'] = 'repeated_failure'
                break
        else:
            ledger['status'] = 'iteration_limit_reached'
    except KeyboardInterrupt:
        ledger['status'] = 'interrupted'
    except subprocess.TimeoutExpired:
        ledger['status'] = 'timeout'
        ledger['note'] = 'The interrupted invocation may have unreported usage. Inspect its logs before resuming.'
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        ledger['status'] = 'runner_error'
        ledger['error'] = str(error)
    finally:
        persist()
        (lock / 'pid').unlink(missing_ok=True)
        lock.rmdir()
    print(f'Stopped: {ledger["status"]}. Summary: {run_dir / "summary.json"}', flush=True)
    return 0 if ledger['status'] == 'complete' else 2


if __name__ == '__main__':
    sys.exit(main())
