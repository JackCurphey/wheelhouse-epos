WP: none (Cycle to Work follow-up from `message-attachments`: the quote PDF's Helvetica can't print letters such as Ł)

## Why

The Cycle to Work quote PDF used pdfkit's built-in Helvetica, which only covers Western European letters. A name such as "Łukasz Wiśniewski" printed wrongly: Ł has no letter in Helvetica. Names are the customer's own, so the PDF must print them as written.

## What Changes

- The quote PDF embeds **Noto Sans** (regular and bold), under the SIL Open Font License 1.1, in place of Helvetica. pdfkit embeds only the letters used, so the file stays small.
- The font comes from a new dependency, `@expo-google-fonts/noto-sans` 0.4.2, pinned exactly. It holds one file per weight covering Latin, Greek and Cyrillic, has no dependencies of its own, and ships the font's licence (`LICENSE_FONT`). `@fontsource/noto-sans` was not used: it splits each weight into per-script files, so no one file covers "Łukasz".
- The layout, wording and sizes are unchanged.
- The test's PDF reader now reads text written in an embedded font, through the font's ToUnicode map.

## Capabilities

### New Capabilities

None. A small piece: no spec change (`skip_specs`).

### Modified Capabilities

None.

## Touches

- `server/c2w/quote-pdf.js`, `tests/c2w-quote-pdf.test.js`, `package.json`, `package-lock.json`.
- Not a risky area.
- Updates the earlier default "A4, black on white, Helvetica" in `docs/decisions/decided-while-building/2026-11-jack.md`; logged there as a default Jack can overrule.

## Out of scope

- Scripts Noto Sans doesn't cover (for example Arabic, Chinese or Hindi names). Those would need a further Noto font each.
