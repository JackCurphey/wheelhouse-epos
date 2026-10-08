# OpenSpec only — how each piece is specified (8 Oct 2026)

**Who decided.** Mark, 8 Oct 2026, in chat, stating it is Jack's decision
too. Jack to confirm on #186.

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

**What it replaces.** Build plan §4 step 2: a short spec as a section in a
file in `docs/superpowers/specs/`. That folder is now history; no new files
go there.

**What stays.** The plans for order and lanes; Jack's decisions in
`docs/decisions/`; `.agents/STATUS.md` and the build board; the drawings.
