# Design
- `RadioPillGroup` renders a `div` with `role="radiogroup"`. After each render it sets `tabIndex` 0 on the checked radio (else the first enabled one) and -1 on the rest. Its `onKeyDown` moves focus among enabled radios with the arrows (wrapping) and Home/End, and clicks the one moved to unless `pickOnMove={false}`.
- The pills keep their own markup; only the group element changes.
