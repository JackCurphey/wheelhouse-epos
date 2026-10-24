# Tasks

## 1. Server

- [x] 1.1 Tests first (`tests/line-done-notes.test.js`): tick and untick; a note saved, trimmed, cleared and capped; refused on finished work, a paid order and another order's line; kept through `PUT …/items` by id; an approved quote line's reason as the note; never in the portal's booking view. Watch each fail. Six failed for the reason intended; the seventh (never on the booking page) passed until notes existed, then went red when the note was really put in the page's view
- [x] 1.2 Migration 074, the route and the carry-over; the quote's reason. Check on a scratch database migrated from empty. Done on `lines1`: 074 applied on top of 073. Mutations caught: no carry-over, no finished check, no quote reason, an untrimmed note, the note shown to the customer
- [x] 1.3 `/review` (migration, money); `npm test`. The review found three real problems (a tick lost in a concurrent save, a doubled id, a typed note lost on refusal), all fixed with tests; the fourth (the old app wiping ticks) can't happen, because the old app sends job orders to the new till

## 2. Screen

- [x] 2.1 Tests first (`tests/screens/work-parts.test.js`): the Done tick saves; "+ Add note", writing and leaving saves; a quantity change sends the ids; both disabled on finished work. Watch each fail. Seven failed first, including the two changed expectations (ids now sent). Mutations caught: no ids, no finished gate, a note not saved, a tick not shown
- [x] 2.2 Build it to the drawings
- [x] 2.3 `npm test`, `npm run test:browser`, lint; archive as the last commit
