## Why

The old app's job form sends its dropdown's status on every Save, and the
old statuses have no "in progress". So every Save — even one that only
changed the notes — put work in progress back to "not started". Found while
writing the workshop-jobs spec and confirmed on a test server (8 Oct); Jack
chose the fix the same day
(`docs/decisions/2026-10-08-old-form-save-keeps-progress.md`).

## What Changes

- A save whose status matches what the job already reads changes none of the
  job's states. A save that changes the status still sets the states as
  before.
- Unchanged: the old form's "Reopen job" (a real change of status) still
  reopens a cancelled or finished job.

Out of scope: retiring the old job form; the job page's own buttons.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workshop-jobs`: "The old app can still set a job's status on create and
  save" — an unchanged status no longer resets the job.

## Impact

- Lane: the job save route is the workshop's (Jack's); a server change by
  Jack, so Mark approves.
- Code: one comparison in `PUT /api/workshop-jobs/:id`; two server tests.
