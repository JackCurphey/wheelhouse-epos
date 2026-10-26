# Design: How much waits while the kind of deposit is saving

1. **`NumberSetting` takes a `disabled` prop** (default off), added to its
   existing "not loaded yet" check, so every other number box is unchanged.
2. **`DepositSetting` passes its own `saving` flag** to both "How much"
   boxes. That flag already disables the switch and the kind buttons while
   their save is answered; the box now follows the same pattern.

## Decision log

- Disabled while saving, not swapping the box the moment the kind is picked:
  it follows the pattern already on the switch and buttons beside it, and a
  swap ahead of the answer would let the amount's save race the kind's.
- Checked in a real browser with the answer held back 400 ms: the box goes
  percentage, greyed out, then pounds, and was never the percentage box
  again in between in five runs.
