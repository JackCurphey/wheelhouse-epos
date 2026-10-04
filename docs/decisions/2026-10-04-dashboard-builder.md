# Live dashboard replaces the build board (4 Oct 2026)

**Source:** Vox (@Voxyz_ai), 26 Sep 2026, via the Code Newsletter archive
(https://archive.codenewsletter.ai/2103946635831050740): a helper agent,
`dashboard-builder`, that keeps a self-refreshing progress page for long tasks.

## Jack's decisions

1. **Use the idea, and replace the build board with it.** ("i actually would
   like it to replace the build board we have")
2. **Local dashboard only, for now.** `.dashboard/index.html` on Jack's Mac. It
   isn't published, so Mark and Jack's phone can't see it. ("lets just do a local
   dashboard fornow")
3. **Install the impeccable design skill.** ("go ahead with impeccable")

## How it was set up, and why it differs from the post

| The post | Here | Why |
|---|---|---|
| Agent and rule in `~/.claude` | In this project's `.claude/agents/` and `CLAUDE.md` ("Jack's dashboard") | `~/.claude` is Mark's setup, synced from his repo; Jack wants his own setup per project |
| `memory: user` | No agent memory; Jack's style is saved in `.dashboard/style.md` in the main checkout (gitignored) | `user` memory lives in `~/.claude`, and project memory is per worktree, so a worktree session would ask Jack again |
| "Only read and write `.dashboard/` and its memory" | A hook, `.claude/hooks/dashboard-guard.mjs`, tested in `tests/dashboard-guard.test.js`, limits it to the main checkout's `.dashboard/` (also from a worktree) | Claude Code has no setting that limits an agent to one folder. The hook only runs once the project folder is trusted in Claude Code, and not in a `claude -p` run |
| The agent asks Jack his style | The agent replies `STYLE NEEDED`; the main session asks Jack | Helper agents can't ask questions |
| Preload the design skill | The agent reads impeccable's `craft-floor.md` and `operate.md` when it designs the page | Preloading the whole skill makes it try to run its own setup and read the whole project, both blocked by the guard, and costs extra on every update |
| "Keep going with the default" on every decision | Only for decisions the project rules let Claude make; the "Always stop and ask Jack" list still stops | That list is Jack's recorded rule |

Impeccable (Paul Bakaus, Apache 2.0, https://github.com/pbakaus/impeccable) is
installed into this project only, with
`npx impeccable install --providers=claude --scope=project --no-hooks`. Its
automatic checks after every edit are **off**, and `CLAUDE.md` says to use it for
the dashboard only, never on app or website screens, which are built exactly to
the drawings. Its 14 MB engine program isn't committed; the
launcher downloads it to `~/.impeccable/bin/` when it's needed.

The old build board artifact (https://claude.ai/artifact/NSgsNTKzrYr6GUK4GjF3by)
is no longer updated. It is kept, not deleted.
