# Design: the note-and-coin counter

## Where it lives

- `src/lib/cash-count.ts`: the sums, with no screen. `DENOMINATIONS` (label
  and pence, £50 to 1p), `countedPence(counts)` (the boxes added up, or
  `null` when every box is empty), `parseTotal(text)` (a typed total to
  pence: `{ pence }`, `null` for empty, or `{ invalid: true }`), and
  `penceText(pence)` ("£208.70"). Pence are whole numbers; pounds are never
  multiplied as decimals, so 1 × 10p + 1 × 20p is 30 pence, not
  29.999… (`parseTotal` splits "0.29" at the point rather than working out
  0.29 × 100, which is 28.999… in floating point).
- `src/components/ui/note-coin-counter.tsx`: `NoteCoinCounter`, beside the
  other shared parts (the day diary, the month calendar). It has no server
  and no route; the float check and Close the day place it.

## The contract (a note for the reader)

```ts
<NoteCoinCounter onChange={(pence: number | null) => void} />
```

`onChange` is called whenever the count changes, with the counted amount in
whole pence, or `null` when nothing is counted (every box empty and no
typed total, or a typed total that isn't pounds and pence). The page around
it turns "Done counting" on when it gets a number.

## How it follows the drawings

- The grid: `cashup.mjs` `denomGrid` (two columns on a phone, three on a
  tablet, four on a computer; each box a label with the note, "×" and a
  numeric box; on a computer or tablet the box's worth on the right).
- The total: `cashup.mjs` `totalBox` ("Cash counted", "Adds up from the
  boxes — or type the total", a box named "Cash counted, total", showing
  "£208.70").
- `op-float-count` draws a read-only "Counted" line instead of the box;
  `consolidate/j10.mjs:11` merges it into `eod-count`, "drawn once", so the
  `eod-count` version is built for both.
- Colours are the design tokens (`--wh-panel`, `--wh-border`, `--wh-ink`,
  `--wh-muted`, `--wh-input-border`, and `--wh-danger-hover` for a wrong
  total, as the email receipt's wrong address uses); boxes are at least 44px
  high. Keyboard focus copies the shared Input's outline classes
  (`src/components/ui/input.tsx`); the component itself isn't used because
  its class merging drops this part's `text-size-*` classes.

## Where the drawings are silent (logged in Jack's section of `decided-while-building.md`)

1. What a box does with a letter or minus sign: it keeps only the digits,
   and a keystroke that changes nothing leaves a typed total alone. A box
   takes at most five digits, and a count too big to add up exactly is
   nothing counted.
2. Changing a box after typing the total: the boxes add up again (the last
   thing typed wins). Emptying the typed total and leaving the box goes back
   to the boxes; while still typing it stays empty (review, 26 Oct).
3. A typed total that isn't pounds and pence ("12.345", "abc", "12,34"):
   the box is marked wrong (`aria-invalid` and the red edge), "Pounds and
   pence, like 208.70" shows below it in a polite live region, both it and
   the hint describe the box (`aria-describedby`), and the page is told
   nothing is counted. "£", spaces, thousands commas ("£1,234.50"), a
   trailing point ("12.") and one or two pence digits are accepted; a lone
   "£" is empty.
4. The worth beside each box shows only once that box has more than 0, as
   the drawing's filled grid shows.
