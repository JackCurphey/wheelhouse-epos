# OpenSpec only — how each piece is specified (8 Oct 2026)

**Who decided.** Mark, 8 Oct 2026, in chat, stating it is Jack's decision
too. Confirmed by Jack on #186, 8 Oct 2026.

**Decision.**
1. **OpenSpec is the only place specs are written.** Every piece of work is
   an OpenSpec change in `openspec/changes/<name>/` (proposal, specs, design,
   tasks).
2. **The two plans stay as the roadmap.** The build plan
   (`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`) and the
   split plan (`docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`)
   set only the order of work and the lanes.
3. **Area specs are written just before work first touches an area**, not
   all filled in at once.
4. **Archiving is the last commit in the change's own pull request**, before
   it merges, not after.
5. **The split stays; whole features are delivered end to end, in sync**
   (Mark, 8 Oct; confirmed by Jack on #186). Mark still builds the server
   half and Jack the screens half (split plan §4.3), but each work package
   is one OpenSpec change covering both halves: the contract goes in its
   `design.md`, what the feature does in its specs, and its `tasks.md` lists
   both Mark's server tasks and Jack's screens tasks. It is archived once
   both halves are in, so `openspec/specs/` only ever describes whole,
   working features.

6. **Mark still runs one package ahead** (split plan §4.4; Jack, 8 Oct,
   #186). `main` may carry a package's change, not yet archived, between
   the two halves; the archive is the last commit of the second pull
   request.

**What it replaces.** Build plan §4 step 2: a short spec as a section in a
file in `docs/superpowers/specs/`, which also held split plan §4.3's
contract. That folder is now history; no new files
go there.

**What stays.** The plans for order and lanes; Jack's decisions in
`docs/decisions/`; `.agents/STATUS.md` and the build board; the drawings.
