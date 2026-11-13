WP: WP-5.3

## Why

Part 1 of Reports and accounts (`openspec/changes/archive/2026-11-11-reports-sales-and-takings`, built as #683, #685, #689, #690) gives the Reports page, Sales, and Takings and cash-ups. Its proposal split WP-5.3 into four parts; part 2 (`openspec/changes/reports-ready-made`) is the other ready-made reports and part 3 is the shop's own reports. This change is **part 4, the last of WP-5.3: sending each closed day to accounts software, and reopening a closed day**. The two belong together because reopening a day corrects what was sent (Jack's decision 4, 1 Oct: "a day that's reopened is corrected when it closes again", `reports.mjs`). On 9 Nov Jack chose to have each piece's spec written one piece ahead, with its questions answered before building. **It is not built yet;** a builder session builds from it once Jack has answered `design.md`'s questions.

An owner's accountant today gets figures out of Wheelhouse by hand. Reports and accounts decision 4 (`docs/decisions/2026-10-01-reports-and-accounts-review.md`) chose that Xero or QuickBooks gets one summary per shop per closed day: sales split by the account each category goes to, the VAT, and the money taken by how it was paid. Which account each line goes to is chosen once, when connecting; a day that can't go shows on Today, with a list of what was sent; shops with neither get the same figures to download. Cash-up decision 6 (`docs/decisions/2026-09-29-cash-up-review.md`) chose that a closed day can be reopened by a manager from Reports, with a reason (a manager needs "Can close the day", `docs/decisions/2026-10-05-roles-and-switches.md`, answer 6), and the Reports audit (`docs/design/user-journeys/reports-ui-audit.md` H1, H2, M12, M15, all taken by decision 8) added a "Sent to Xero" column on Takings and cash-ups and the called-out reopened day. No shop needs either at switch-over (`docs/decisions/2026-10-16-go-live-checklist.md`, "Accounts software: none at switch-over"), and Jack's rule is that outside services sit behind an adapter with a pretend version until he says yes to a real account. So this change builds all of it against a pretend accounts service, and **connecting a real Xero or QuickBooks account stays out until Jack says yes** (and until Mark has the developer access on the build plan's Q10 list).

## What Changes

### Reopen this day (rp-reopen, rp-takings-reopened)

- A closed day's report (`rp-day`, built in part 1) gains **Reopen this day**. It asks "Why are you reopening it? (needed)", saved with the person's name and the time, and says the day goes back to Needs attention and that what was sent to the accounts software is corrected when it closes again (`reopenDialog`, `reports.mjs`). Owner only until roles (WP-1.1).
- A reopened day's **row keeps the figures it was closed with** (marked Reopened, its report can still be opened, its Online row stays), while the **headline figures, the graph and the months leave it out until it closes again**, and the report says so (audit H2; Jack, 12 Nov, following the drawing): Takings and cash-ups shows "Wed 16 Sep is reopened — its figures are left out until it's closed again" with a "Close the day" button (`rp-takings-reopened`).
- The reopened day returns to Today's Needs attention with "Close it", like a day nobody closed (`openspec/specs/today`, "A day nobody closed goes to Needs attention with Close it").
- Closing it again makes a new close for that day. The first close is kept as history, not deleted. Only the latest closed day can be reopened, and the new close counts only that day's own sales; a sale saved after the first close stays for the next close (Jack's answers 4 and 1, 12 Nov).

### Accounts software (rp-accounts-connect, rp-accounts-map, rp-accounts-missing, rp-accounts-log, rp-accounts-lost, rp-accounts-disconnect)

- **Settings › Your data › Accounts software** (a fold on the page Your data already has, `set-data-export`): "Connect Xero" and "Connect QuickBooks" (Owner only), then "Connected to Xero · by Jack Lewis on [date]" with the choices of which account each line goes to, **Sales go to** (each category), **Money taken goes to** (Cash, Card, Customer accounts, Gift cards), **Everything else goes to** (Cash differences, Refunds, Discounts given, VAT on sales), the note "VAT on sales goes to one Xero account for every rate. Check these choices with your accountant before the first day is sent.", and "Disconnect Xero" with its dialog. All behind an **accounts adapter** with a **pretend Xero and QuickBooks** that holds what was sent in Wheelhouse's own database; no real account, key or network call.
- **What was sent**, a list in the same fold: one row per closed day with "Sent at [time] · £[£]" and a Sent badge, "Closed at [time] · [Category] has no Xero account chosen" with "Choose an account for [Category]" (a day that can't go), "Not closed yet", and, when disconnected, "Closed at [time] · sends when Xero is reconnected" with a Waiting badge, and "Xero disconnected on [date]. Nothing has been sent since. Reconnect and the waiting days go across." with Reconnect.
- **Each closed day is sent once** when it closes (and again, corrected, when a reopened day closes again), as one summary for the shop. A day that can't go (a category with no account chosen) waits, and goes when the choice is made; the owner is told on **Today** ("Wednesday 16 September didn't go to Xero" with "Choose an account for [Category]", `rp-today-accounts`).
- **Takings and cash-ups gains the "Sent to Xero" column** with Sent, Not closed yet, Reopened and Not sent badges (`rp-takings`, `rp-takings-reopened`), shown only while accounts software is connected.
- **The same daily figures to download** for shops with neither (decision 4; Your data's answer 5, `docs/decisions/2026-11-10-your-data-answers.md`, which left them out "until Reports and accounts software are built"): "Download everything" gains a daily figures list, one row per closed day with the same lines the summary has (the drawing's note: "Not using either? 'Download everything' above has the same daily figures to import.").

### Not in this change, and why

- **A real Xero or QuickBooks account**: Jack's yes, and Mark's developer access (build plan Q10). The adapter is built so a real one slots in behind it.
- **Cycle to Work in the summary** (`rp-accounts-c2w`, its payments, commission and shortfalls): comes with WP-7.1 (Cycle to Work), as part 1's proposal said; the rows are left out of the choices until then.
- **"All shops"** and a summary per shop for several shops (`rp-accounts-log` draws a second site): comes with the shop switcher (Multiple sites, WP-5.2). One shop today, so one summary a day.
- **Managers**: "A manager can reopen it from there" (`reports.mjs`) and "Sent to Xero" for managers wait for roles (WP-1.1); Owner only meanwhile (`docs/decisions/2026-10-19-owner-only-settings.md`).
- **Parts 2 and 3** of WP-5.3 (the other ready-made reports; the shop's own reports) are their own changes; nothing here depends on them. VAT in this change is only what the summary carries, never the VAT report.

## Who and risk

WP-5.3 part 4, one builder session, in four pull requests (`tasks.md`). **Risky: yes, two ways.** It adds **migrations** (reopened closes and the history of closes; the accounts connection and choices; what was sent), and it changes **money**: reopening changes how a close is saved and re-saved, and the send reads the closed day's money. It does not change how a sale, a payment or a refund is saved. Each pull request that includes a migration or touches `server/routes/close-the-day.js` needs `/review` before merging and goes in the weekly digest (`openspec/changes/working-agreement/design.md`). It touches no sign-in, no `/api/portal/*`, no `server/server.js`, `server/db.js` or messaging. Mark's areas (roles, the settings store and activity log, sales step C, the till deposit) are untouched; the activity log, when it exists, should record a reopening and a connection, which is its own later task.

## Follows

- Decisions: `docs/decisions/2026-10-01-reports-and-accounts-review.md` 4 (a summary per shop per closed day; mapping chosen once; shops without software download the figures) and its audit items H1, H2, H4, H5, M12, M15, with its later changes of 3 Oct (the strip; "Takings" has one meaning); `docs/decisions/2026-09-29-cash-up-review.md` 6 and its later change of 1 Oct (Reopen, from Reports); `docs/decisions/2026-10-05-roles-and-switches.md` answer 6 (reopening needs "Can close the day"); `docs/decisions/2026-10-02-ux-walkthrough.md` (walk-through 2 M5, the online line goes with the day's summary; 5 H3, Cycle to Work later); `docs/decisions/2026-10-19-owner-only-settings.md`; `docs/decisions/2026-10-16-go-live-checklist.md` ("Accounts software: none at switch-over"); `docs/decisions/2026-11-10-your-data-answers.md` 5; `docs/decisions/2026-11-11-reports-part-2-answers.md` 3 (VAT in the old sales record); `docs/decisions/2026-10-18-build-for-every-shop.md`; the close-the-day answers of 27 and 29 Oct as built (`openspec/specs/close-the-day/spec.md`).
- Drawings (`docs/design/user-journeys/generator/reports.mjs`, `opening.mjs`; screen ids in `journeys.mjs` journey j17): `rp-accounts-connect`, `rp-accounts-map`, `rp-accounts-missing`, `rp-accounts-log`, `rp-accounts-lost`, `rp-accounts-disconnect`, `rp-today-accounts`, `rp-reopen`, `rp-takings-reopened`, and `rp-takings` / `rp-day` (their "Sent to Xero" column and Reopen button, left out of part 1).
- Built: `openspec/specs/reports` (part 1), `openspec/specs/close-the-day` and `openspec/specs/today`, `openspec/specs/your-data` (Download everything), the `day_closes` table (migration 096) and its late-close fields (migration 106), the adapters pattern (`server/payments/`, `server/signin/`: a provider chosen by a setting, with a pretend one).

## Capabilities

### New Capabilities
- `accounts-software`: connecting accounts software (pretend), choosing the account each line goes to, sending each closed day as one summary, what was sent, a day that can't go, and disconnecting.

### Modified Capabilities
- `reports`: the "Sent to Xero" column and the reopened-day bar on Takings and cash-ups; Reopen this day on a closed day's report.
- `close-the-day`: reopening a closed day, and closing it again.
- `today`: a day that didn't go to the accounts software, and a reopened day, in Needs attention.
- `your-data`: the daily figures in Download everything.

## Impact

- New: `server/accounts/` (the adapter, `pretend.js`, the summary builder), routes for the connection, choices and log in `server/routes/accounts.js` (Owner only), three migrations (see `design.md`), `src/screens/settings/accounts-software.tsx` (the fold), Reopen this day's dialog and the Sent to Xero column in `src/screens/reports/`.
- Changed: `server/routes/close-the-day.js` (a close can be reopened and made again; a close sends its summary), `server/routes/today.js` (two Needs attention kinds), `server/shop-data-copy.js` (the daily figures list), `src/screens/settings/settings-page.tsx` (the fold), Today's page (the two lines), Takings and cash-ups (`src/screens/reports/takings-report.tsx`) and the day report (`src/screens/till/close-the-day.tsx`'s shared report).
- No dependency added: the pretend accounts service is plain code and Wheelhouse's own tables.
