# Design: the confirmed booking page

## Words (pending-rules.ts)

- `pageHeading(link)`: "[bike] · [work]". Bike: make and model, else "Your bike". Work: the one service's name; with more, "[first] and [n] more"; with none, "Repair".
- Eyebrow: "Your repair · [reference]".
- `bikeRow(link)`: make and model; with no make or model, the customer's own words about the bike (`bikeNote`); else none.
- Service rows: each service "[name] · [£price]", or the name alone when the shop hides prices; "From £T" stays under them for two or more.

## Screen

- `BookFrame` gains an optional `eyebrow`, a small muted line above the h1 (the h1 keeps its focus on arrival).
- Only `stage === 'confirmed'` takes the new layout; every other stage renders as today.
- Card order: badge (in a `role="status"` region, as drawn), the drop-off sentence and note, the rows (label left, value right, as `kv`), then what the customer told the shop and their answers, then the shop's name on a line with a top border.
