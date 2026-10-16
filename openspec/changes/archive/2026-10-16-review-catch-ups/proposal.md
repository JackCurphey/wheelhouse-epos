# Proposal: four places the diary catches up with its drawings

## Why

The diary layout review (#238) found four things the drawings show that
weren't built. Jack, 16 Oct: build them.

## What Changes

1. **How to open a Waiting card** (item 3): once a card is chosen, the note
   under the cards says "Double-click a card to open it.", or "Tap the card
   again to open it." when it was chosen by a tap (`diary.mjs` ~555, and the
   tablet's wording; decision 14).
2. **Tablet-sized Waiting cards and Open** (item 4): on a touch screen the
   card's words are larger (12 / 15 / 13) and Open is a 44px finger target
   (`diary.mjs` ~1468). The drawn bike line is left for later: the waiting
   list doesn't carry the bike, and adding it is a server change that needs
   Mark's approval.
3. **Week / Day 44px tall on a touch screen** (item 5, `diary.mjs` ~1180).
4. **A change request's "Open full job"** (item 8, `diary.mjs` ~1935): it
   closes the pop-up and opens the job page; Decline and it share a row,
   stacked on a phone.

"Touch screen" means a device whose main pointer is a finger (the CSS
`pointer: coarse` test), which is how the drawings' tablet size is told
apart from a small computer window.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/**`. No server change.
- **Drawings:** `diary`, `change-selected`, `request-change` (tablet and
  desktop), as cited. Nothing changes in them.
- **Decisions:** decision 14 kept. Jack's yes on 16 Oct.

## Out of scope

- The bike line on tablet cards (needs the server; for Mark).
- The review's other items (1, 6, 7, 9), each Jack's to decide.

## Impact

- `src/screens/diary/diary-page.tsx`, `src/screens/diary/request-dialog.tsx`,
  their screen tests and `tests/browser/diary-extras.spec.ts`.
