# Design

## 1. Where it sits

`settings-page.tsx` holds rooms, areas and folds. Stockroom's folds become Stock adjustments, then Categories, as `stockFolds` draws them. The fold's body is `CategoriesSettings`; its summary is `useCategoriesSummary()`. Both read `GET /api/product-categories` through `['product-categories']`, so one fetch serves both.

## 2. The contract (piece 4's server, unchanged)

- `GET /api/product-categories` → `{ categories: [{ id, name, parentId, path, products, details: [{ id, name, kind, unit, choices, answered }] }] }`, in path order.
- `POST /api/product-categories { name, parentId }` → 201, the new category.
- `PUT /api/product-categories/:id { parentId, details }` → the category. `details` is the whole list of its own details, each `{ id?, name, kind, unit?, choices? }`; a detail left out is removed with its answers; one without an `id` is added.
- Refusals come as `{ error }` in the server's words, shown in the box's alert, and the box stays open.

## 3. The list

Each row is a list item, set in 24 px for each category above it, with "↳" (hidden from screen readers) and "Inside [parent]: " (read only by them), as drawn. The second line names its own details, "Name (unit)", "Name (a choice)", "Name"; adds "passed down to its sub-categories" when it has some and categories inside it, and "and [Parent]’s details" when one above has some. With none of either it reads "No details yet".

The fold's summary names the most particular categories, those with none inside them, the first two in list order, then "and n more": the drawing's "Bearings, Drivetrain › Derailleurs" skips Drivetrain for its Derailleurs.

## 4. The box

A `Dialog` (`aria-labelledby="cat-title"`, 660 px wide on a computer, the whole width and scrolling inside 90 % of the height on a phone, as the other boxes).

- **Sits inside**: a combobox (`cat-parent`) listing up to 8 paths that contain what's typed, leaving out the category itself and everything inside it; ArrowDown/ArrowUp and Enter pick, as the stock take's product search does (`useActiveOption`). Empty is the top. A path typed but not picked is refused before anything is sent: "Pick where it sits from the list".
- **From [ancestor]**: one line per category above with details, its details' names, and "Change it on [ancestor]", which opens that category's box in place of this one.
- **Own details**: a Detail name box, its kind as words ("A number in mm", "A choice from a list", "Text"; not changeable, as drawn), Remove. A choice's pills each have "Remove the choice [c]"; "Add a choice" adds on Enter or on leaving it. A removed detail stays in the list struck through, "· removed", with "Undo removing [name]" until Save (M15).
- **Add a detail**: name, Kind of answer (pills), then a Unit for a number or its choices for a choice; text asks for nothing more (H4). Enter in the name or the Unit, or "Add this detail", adds it; Enter in its choices adds a choice. A new detail's choices are taken off once it's in the list, with its other choices.
- **The note**: "Every product in [name] — already in stock or added later — gets these details.", and when a removed detail has answers, " Saving removes [names] from [n] product(s)." from each detail's `answered`.
- **Save**: an existing category sends one PUT. A new one sends the POST, then a PUT with its details if it has any. Then `['product-categories']` is fetched afresh and the box closes.

## 5. Keyboard and phone

Every control is a native button, input or radio pill, in reading order; the box traps focus and Escape closes it (`Dialog`). At 375 px nothing scrolls sideways: a detail's row wraps, and the box scrolls inside. The browser test drives both widths by keyboard.
