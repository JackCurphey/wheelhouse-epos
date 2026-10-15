# The old job form's Save keeps a job's progress — Jack's decision (8 Oct 2026)

**What happened.** The old app's job form (the old diary at `/`) sends its
status dropdown on every Save, and the server set the job's booking and work
states from that one word. The old statuses have no "in progress", so every
Save — even a notes-only one — put work in progress back to "not started".
Found while writing the workshop-jobs OpenSpec spec; confirmed by a fresh
reviewer on a test server. No shop uses Wheelhouse yet; Jack and Mark use
the old app while testing.

**Decision** (Jack, 8 Oct: "1"). A Save only changes the job's progress when
the status was actually changed: a status the job already reads changes
nothing. A real change of status still sets the states, so the old form's
"Reopen job" still reopens a cancelled or finished job. Chosen over leaving
it as a known problem until the old job form is retired.
