# Design

## 1. The switch
- **Stored as** `showLegend` in the login's preferences, with the other
  switches.
- **Unlike the others, it starts on.** `server/routes/your-settings.js` gets
  a `DEFAULT_ON` list. A switch never saved reads as its default, so every
  existing login sees the legend.

## 2. Your settings
- **"Show the diary legend"** is the first row, with the hint "The key to
  what each colour means, beside the Workshop diary. Switch it off once you
  know them.", as drawn (`ys-legend`).
- **Not on a phone,** as Folded sidebar isn't: the phone diary has no
  legend.

## 3. The diary
- **The left-hand column** becomes a wrapper holding the legend box, then
  the Waiting section. The wrapper takes the column's width and its
  `hidden lg:flex`.
- **The legend box** is a section headed "Legend", whose list is named
  "Legend".
- **Below 1024px** (`useIsNarrow`) the same list sits under the toolbar,
  along one line. The legend is drawn once, by JavaScript, never twice.
- **The status symbols** stay on the legend's swatches when that switch is
  on.

## 4. Decided here (logged)
- The legend under the toolbar below 1024px.
- No switch on a phone.
