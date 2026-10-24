# Design: Larger text

## Decisions

1. **One scale**: `:root { --wh-text-scale: 1 }`, and `html.wh-larger-text {
   --wh-text-scale: calc(17 / 14) }`. In Tailwind's theme the named sizes
   (`--text-xs` to `--text-3xl`) become `calc(<size> * var(--wh-text-scale))`,
   and each fixed size used (10, 11, 12.5, 13, 13.5, 15, 17, 22, 26, 30, 34px)
   gets a scaled token, `text-size-15` and so on. Line heights stay as Tailwind
   has them (ratios, so they follow the size).
2. **The change across the app** is mechanical: `text-[15px]` becomes
   `text-size-15` (`text-[12.5px]` becomes `text-size-12-5`). A check in
   `tests/design-tokens.test.js` fails on any `text-[Npx]` left.
3. **The switch** joins Your settings' rows after Reduce motion, as drawn
   (Don't close things by themselves is drawn between them and isn't built
   yet), with the drawing's preview: "Normal" at 14 and "Larger" at 17,
   fixed so the preview shows the difference whichever is on.
4. **On the page**: `useAccessibilityClasses` adds `wh-larger-text` to the
   page with the person's switch, as Reduce motion's class is added.
