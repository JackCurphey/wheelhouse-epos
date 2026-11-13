# The daily status job stays, and folds in the board bot's pull request (Jack, 13 Nov 2026)

**What changed.** Point 4 of `2026-11-11-speeding-up-the-build.md`. It said
the daily status pull request stops once the build board fills itself in.
That no longer holds: the daily status job carries on every night.

**Why.** The board bot (`.github/workflows/board.yml`, #673) only adds a
"done" row for each merged pull request. It can't write the board's
hand-written parts, and it can't republish the board on claude.ai. The
published board and the "Start here" section of `.agents/STATUS.md` still need
a person, or this job, to keep them current.

**Jack's answer.** Option 1, given to the Front desk session on 11 Nov, and
confirmed on 13 Nov after the job had stopped two nights running.

**What the job does each night.**

1. Brings `.agents/STATUS.md`'s "Start here" up to date: who is on what, and
   each new merge.
2. If the bot's "Board: merged up to #N" pull request is open, merges it into
   the status branch, so the status pull request carries its rows and GitHub
   marks it merged too. If there isn't one, it adds the rows by hand.
3. Writes the board's hand-written parts by hand: the "Merged ..." line, the
   lead, the asks, the overview, who is on what, and each slice's status.
4. Runs lint, the board's test, `npm test` and `npm run test:browser`, opens
   the status pull request and merges it when they pass.
5. Republishes the board on claude.ai.
