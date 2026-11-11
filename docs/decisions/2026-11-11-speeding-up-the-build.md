# Speeding up the build: six changes (Jack, 11 Nov 2026)

**The question.** Issue #669 (Mark, 11 Nov). The build had slowed since the
week of 19 Oct, and Jack was hitting his Claude limits quickly. Measured:
each session read about 49,000 tokens before starting; the full tests took
about 37 minutes on GitHub; the same progress was written in up to six
places; and every session and helper ran on Opus.

**Jack's answer** (on #669, 11 Nov): "All six."

1. **A short "Start here" for every session.** The top of `.agents/STATUS.md`
   is a short section: who is on what, and the next pieces each. Older
   detail moves, word for word, to `.agents/ARCHIVE.md`. Sessions read that
   section, plus only the part of the build plan for the piece in hand.
2. **`decided-while-building.md` is split.** New entries go in one file per
   person per month in `docs/decisions/decided-while-building/` (for example
   `2026-11-jack.md`). The old file stays as it is, holding everything up to
   11 Nov. Nothing is deleted.
3. **Related tests while building, the full set before merging.** While
   building and fixing, Claude runs only the test files for what it changed.
   `npm test` and `npm run test:browser` still pass on the final commit
   before merging, as the 28 Oct decision says. Mark also makes the full set
   faster.
4. **The build board fills itself in.** A script adds what has merged to the
   board, and a nightly GitHub workflow opens a pull request with it (Mark,
   11 Nov). The daily status pull request stops once that runs. The "who is
   on what" lines stay hand-written in STATUS, changed when someone takes a
   piece. Jack switches off his nightly status job on his Mac once the board
   fills itself in.
5. **A short OpenSpec for small pieces.** A piece under about 200 changed
   lines, outside the four risky areas, has a proposal and a task list only:
   no design file and no spec files. Risky areas keep the full version.
6. **Cheaper Claude models for most of the work.** Sessions start on Sonnet;
   reading goes to a Haiku helper; reviews use Sonnet, and Opus in the four
   risky areas (#670).

**What this changes in earlier decisions.** Point 5 narrows
`2026-10-08-openspec-only.md` point 1 ("every piece of work is an OpenSpec
change (proposal, specs, design, tasks)"): small pieces outside the risky
areas are still OpenSpec changes, with a proposal and tasks only. Point 4
replaces rule 7's daily status pull request in `CLAUDE.md`. Nothing else is
reopened.

**What it costs.** Claude reads less history unless it goes looking; the
"for Jack to overrule" notes are spread over several files; a problem in an
unrelated part of the app shows up at the final test run rather than
mid-way; the board's wording is plainer; `openspec/specs/` says less about
small pieces; and Sonnet may build some pieces less well than Opus.
