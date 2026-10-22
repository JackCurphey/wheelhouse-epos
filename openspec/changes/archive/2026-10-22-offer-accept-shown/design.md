# Design

The accept compares the shown date and start time with the job's `job_date`
and `start_time` under the job's booking lock, after the "nothing offered"
check (so a second press after accepting still returns the confirmed page)
and before the "too late" check. Times compare as text, empty for none. The
edit guard compares the day, start, end and mechanic with what is stored,
after the status refusal and before any write.
