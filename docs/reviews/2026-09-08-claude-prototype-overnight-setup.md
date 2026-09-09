# Run the workshop prototype overnight with Claude Code

The [handoff prompt](2026-09-08-claude-prototype-overnight-prompt.md) makes the [agreed prototype decisions](2026-09-08-workshop-prototype-decisions.md) authoritative. It continues the existing implementation and explicitly defers pricing, integrations, real messaging, and production billing.

## Start from a normal terminal

Use this exact working checkout: the prototype and specification include uncommitted/untracked files that are not necessarily in a fresh clone or worktree. Avoid editing the same prototype in another session during the run.

Claude Code is installed here; the flags were checked against installed version 2.1.265 and the official [CLI reference](https://code.claude.com/docs/en/cli-reference). Be signed in through your normal Claude Code login before starting. This setup does not change your account or create an API key.

```sh
cd /Users/curphey/Documents/Github/wheelhouse-epos
python3 scripts/claude-prototype-overnight.py --dry-run
```

The dry run prints the pinned hashes, command, and limits without calling a model or writing run files. To launch overnight on this Mac:

```sh
caffeinate -i python3 scripts/claude-prototype-overnight.py
```

Keep this terminal open. `caffeinate` prevents idle system sleep while the command runs; it does not make closing the laptop lid a supported way to continue. If you want to close the terminal, run the command inside an existing `tmux` session and detach it.

Defaults are **up to eight hours, twelve passes, thirty agentic turns per pass, forty minutes per pass**, with a **200,000 working-token soft stop**. The loop exits early when verified work is complete or there is a blocker. It does not deliberately consume the whole night.

Optional overrides:

```sh
python3 scripts/claude-prototype-overnight.py --hours 6 --iterations 10 --model opus
```

Use `--max-usd AMOUNT` if you want to set an overall CLI-reported API-cost allowance; replace `AMOUNT` with the amount you choose. There is no dollar allowance set by default. Each new session receives the remaining allowance through `--max-budget-usd`. Claude's cost reports are client-side estimates, and subscription usage limits are separate. See the official [programmatic usage documentation](https://code.claude.com/docs/en/headless).

## What the loop does

- Snapshots the current prototype, review documents, runner, and root package/README files into a run-local archive before editing. It also records initial git status. The snapshot is not a full-repository backup and does not contain ignored credentials or user uploads.
- Starts fresh Claude sessions, each with the full pinned spec and handoff prompt, plus the preceding result and log paths. This avoids relying on an accidentally resumed session or a stale conversational summary.
- Uses `prototype/OVERNIGHT.md` for the P-01–P-13 matrix and the next concrete action.
- Hash-checks the canonical spec and handoff between passes. A change stops the run; it is not automatically reverted or accepted.
- Runs `npm run prototype:test` itself after each returned pass. A claim of completion also requires a real `test:browser` command and a successful independent run of it. Browser tests and evidence must be created by Claude; they do not exist at the start of this handoff.
- Saves prompts, JSON results, stdout/stderr, verification logs, usage, and the final reason for stopping under `.prototype-overnight/`. The model writes its browser evidence there as instructed.
- Stops on completion, limits, an explicit blocker, three consecutive failures, a changed spec, invalid usage reporting, a timed-out pass, or Ctrl+C. Timeouts/interruption can leave work in progress; it is never labelled complete automatically.

## Permissions and accounting

The command uses noninteractive permission handling with explicit Read/Edit/Write/Glob/Grep/Bash access. It does not use `--dangerously-skip-permissions`. Project/user settings sources and inherited MCP connections are omitted for this invocation, avoiding the existing design plugins initiating another approval workflow. Managed policy still applies; authentication from the normal installation remains available. No global or project Claude settings file is edited.

**Bash access permits local command execution; the prompt's file boundaries are instructions, not an OS sandbox.** The run is authorised to modify the prototype and run local tests. It is instructed not to publish, send messages, commit, touch unrelated files, or bypass a denied action. The runner itself makes no external application changes beyond invoking Claude's model service.

The working-token ledger adds Claude's reported input, output, and cache-creation tokens, and records cache-read tokens separately. It is checked **between passes**, so a pass can overshoot 200k. This is not a hard total-billed-token ceiling or a direct measurement of the earlier rough estimate. If an invocation is interrupted before returning usage, its consumption may be absent from the ledger; the script stops instead of silently retrying it.

## In the morning

```sh
cat .prototype-overnight/latest.txt
cat prototype/OVERNIGHT.md
```

Open `summary.json` in the printed run directory. Only `"status": "complete"` denotes successful completion through both verification commands. A limit, blocker, timeout, or runner error is an incomplete result with preserved files and logs.

Review the final diff and `prototype/OVERNIGHT.md`, then run:

```sh
npm run prototype
```

Open [the prototype](http://127.0.0.1:4173/). If the earlier dev server still occupies 4173, use that existing server or stop it normally first; do not kill unrelated processes to free a port.

No run has been started by creating this handoff. The runner was tested using fake Claude results and commands, not by spending model tokens. If a process is force-killed and leaves `.prototype-overnight/active.lock`, check its recorded PID and the previous terminal before removing the stale lock and restarting. A restart reuses the current prototype/checkpoint but starts a **new** run ledger and limits.

## Prompt-only use

You can also paste the entire handoff prompt into an interactive Claude Code session in this checkout. For actual overnight continuation, use the runner: a prompt by itself cannot relaunch Claude after a session exits or enforce a wall-clock limit.
