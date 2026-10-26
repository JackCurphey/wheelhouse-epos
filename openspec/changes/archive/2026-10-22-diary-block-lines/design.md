# Design

`block_first` / `block_second` are TEXT with a CHECK of `bike`, `jobTitle`,
`customer`, `reference`, defaulting to `bike` and `jobTitle`, so every shop
keeps today's blocks. The PUT refuses anything else, or the same choice for
both lines; the Settings screen never sends that: choosing the other line's
choice swaps the two.

The diary reads the setting from its existing `/api/workshop-settings` query
and passes it down in `BlockLinesContext`; `blockLine(job, field)` gives the
words (a missing customer reads "Customer", as `describe()` does). The status
keeps its place: its colour, and the word on a wide block's second line.
