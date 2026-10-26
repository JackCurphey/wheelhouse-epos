# The diary's legend as a box above "Waiting for you", with a switch in Your settings

## Why

Jack, 26 Oct: move the diary's legend from the bottom of the diary to the
top, and make it something each person can switch off.

Two layouts were drawn:
1. along the top, under the toolbar;
2. a box at the top of the left-hand column, above "Waiting for you".

Jack chose option 2 ("I like 2"). The box is headed simply "Legend" ("just
call it Legend instead of having a description"). The switch is per person
(Jack's answer: "Each person"). The drawing is updated in `diary.mjs`
(`legendBox`) and in `app-map.mjs` (`ys-legend`).

**Risky area:** none. It's the diary screen, Your settings, and one more
switch in `server/routes/your-settings.js` with no migration (the switches
are stored in a JSON column).

## What changes

- **On a computer or a landscape tablet,** the legend is a box headed
  "Legend" at the top of the left-hand column, above "Waiting for you", one
  colour a line.
- **Where that column is folded away** (narrower than 1024px), the legend
  sits under the toolbar instead, along one line. It's no longer at the
  bottom.
- **Your settings › Accessibility** gains "Show the diary legend" as its
  first switch, on to start. Switched off, the diary shows no legend for
  that person. It isn't offered on a phone, where the diary has no legend.
