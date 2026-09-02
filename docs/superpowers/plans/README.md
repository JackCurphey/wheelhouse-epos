# Implementation plans

Plans are written before the work and executed task-by-task, with steps
tracked as `- [ ]` checkboxes.

## Where plans live

- `plans/` — open plans. Work that has not been done. An agent may pick one
  of these up and implement it.
- `plans/done/` — executed plans, kept for historical context. **Never
  implement one of these.** Each carries a banner at the top naming the
  commits that delivered it.

## Why `done/` exists

The checkboxes in a plan are not a reliable record of progress. Both plans
now in `done/` were fully built and merged in August 2026, yet all 103 of
their steps are still unticked — nobody ticks boxes while shipping. The
result was two large, detailed, imperative-voice plans sitting on master
describing work that already existed, each opening with an instruction to
implement it task-by-task.

So the directory carries the status, not the checkboxes. When a plan is
finished, move it to `done/` and add the banner. Do not rely on ticking
the boxes to signal completion, and do not read unticked boxes in `done/`
as outstanding work.

Anything genuinely left over when a plan is archived gets pulled out into
an issue first, so it survives independently of the file.
