# Journey 20, Management oversight — Jack's decisions (2 Oct 2026)

Journey 20 is how an owner or manager keeps an eye on the shop: who did
what (the activity log), where people are signed in (devices), and how
staff tell the Wheelhouse team about a problem (feedback). Background, not
reopened here: Office › Today has Needs attention, shown only to owners,
managers and anyone with "Can close the day", with "Seen" and "seen by"
(Opening the shop 3, 4, audit H3); checking in records who's in, not hours
(Opening the shop 5); "All shops" is for the owner, and for a manager at
two or more shops (Multiple sites 1, 6, 9); four roles plus switches,
"Can change settings" and owner-only actions hidden from others (Owner
setup 8–10, audit 17); every settings change is recorded with who, when
and what it was before (Owner setup 4); **no manager approvals** —
discounts, refunds and voids need a reason, not a PIN, and managers see
them in reports (Selling at the till 4, 9, 10); big stock adjustments show
on Today (Stock control 6); a closed day is reopened with a reason
(Cash-up 6; Reports and accounts); the Discounts and refunds report shows
who gave each one (Reports and accounts audit M10); only the Owner adds
staff and registers tills (Owner setup 10). Real example data only: North
Street Cycles, Bolton, "[Second site]", Jack Lewis (Owner), Jo Taylor
(Staff), Alex Morgan (Mechanic), Shimano brake pads B05S-RX (£28.00), Till
B1; other names, times and figures are bracketed placeholders. Own canvas:
https://claude.ai/artifact/XLYiuhFS1WVjS9ohF7G7gf, desktop first, then
tablet and phone. Rules for
every journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 —
as few clicks as possible).

1. **One activity log in the Office, for owners and managers** (Jack, 2
   Oct: "1"). Everything already recorded, in one list: price changes,
   voids, refunds, discounts, job changes, stock adjustments, settings
   changes, reopened days and website publishes. Each line shows who, what
   and when, and opens the sale, job or product. Filters by person, kind,
   shop and date; it follows the shop switcher, with "All shops" for the
   owner. The histories already drawn (Settings changes, a product's stock
   history) stay — the same records seen from their own place. Chosen over
   a "What they did" view on each person only, and no new screen.
2. **A few things go to Today's Needs attention, above amounts the shop
   sets** (Jack, 2 Oct: "1"). A discount or refund over £[amount]; more
   than [n] voids by one person in a day; a price changed to below what the
   item cost. Each line says who and what, opens the record, and clears
   with "Seen", as big stock adjustments do (Stock control 6). The amounts
   are set in Settings, and each can be switched off. Nothing slows staff
   down — no approvals. Chosen over a quiet log only, and a weekly email
   (which can be added later).
3. **One "Signed-in devices" list, plus "Sign out everywhere" on each
   person** (Jack, 2 Oct: "1"). In Settings › Office, beside Staff and
   roles: every till at each shop, with who is using it now, and every
   phone or laptop someone has signed into with their email — the device,
   the person, the shop, when it was last used, and "Sign out". A person's
   page has "Sign out everywhere", for a lost phone or someone leaving;
   removing a person already signs them out. Seen by the owner and anyone
   with "Can change settings". Chosen over devices on each person's page
   only, and "Sign out everywhere" with no list.
4. **"Send feedback" in Your settings, for everyone** (Jack, 2 Oct: "1").
   A short form, "What happened, or what's missing?"; Wheelhouse adds which
   screen the person was on; an optional screenshot, unticked to start,
   with a preview, so nothing with customer details goes without the
   person seeing it; "Thanks — we've got it", and any reply by email.
   Chosen over a "?" button in every header, and an email address only.
5. **The activity log opens from Reports** (Jack, 2 Oct: "2"). "Activity"
   sits beside the ready-made reports, for owners and managers only — not
   staff who have "Can see reports". Every alert on Today (decision 2) opens
   the log filtered to it, so that route is one click. The sidebar is
   unchanged. Chosen over its own sidebar item, Office › Activity, and a
   link from Today only.
6. **UI audit: every recommendation taken** (Jack, 2 Oct: "go with all of
   them i think"). From `design/user-journeys/oversight-ui-audit.md`:
   - **At a till, the name is whoever's PIN was last typed**, so the log and
     the alerts say "while Jo Taylor was checked in on Till B1", and the
     log says so in one line (H1).
   - **Staff are told what's recorded and can see their own lines.** Your
     settings has "What Wheelhouse records about you" with "See my own
     activity"; a short note shows the first time someone signs in (H2).
   - How long records are kept is one period set by Wheelhouse, shown on the
     log ([period] until decided, LEG-05). A deleted customer's name is
     removed from log lines (H3).
   - The three alerts show only to owners and managers, not to everyone
     with "Can close the day". Their buttons say what they open (H4).
   - Checking someone out of a till first shows what the till is doing.
     "After this sale" is the default; "Now" puts the basket on hold, and
     it can't happen during a card payment. On tills the button is "Check
     out Jo Taylor" (H5).
   - The feedback picture hides customer details before the preview, with
     "View larger", a written description, and who at Wheelhouse sees it
     and for how long (H6).
   - Every log line shows its shop, with a Shop filter (M1). A manager's
     log, the Reports page without the log for staff, and the log refused
     to staff are drawn. Managers see everyone's lines, the owner's too —
     confirmed by Jack, 2 Oct ("1"), over hiding the owner's own actions
     from managers (M2).
   - An alert is off until an amount is set; each shows how many it would
     have raised in the last 30 days; discounts and refunds have their own
     amounts; a bulk price change raises one alert (M3).
   - "Seen by Jack Lewis at [time]" shows on the log line (M4). Clearer
     alert wording with the reason and the number of sales (M5).
   - Only the owner can sign out the owner's devices; each device shows its
     shop (M6). Signing out and downloading the log are recorded too; only
     the owner changes the alert amounts, managers see them read-only (M7).
   - Buttons named for their item (M8); 44px targets (M9).
   - L1–L6: larger detail text; names in the log filter by that person;
     "Back to Today" when opened from an alert; "Activity log" as the name;
     "Send" greyed until something is typed, and the failed send drawn;
     "Type of action" rather than "Kind".
7. **Tablet and phone drawn; approved and copied into the big canvas**
   (Jack, 2 Oct: "yeah go ahead"). On a tablet the screens keep the
   desktop layout with the icon rail; on a phone the log's lines stack —
   time and name on one line, what happened under it — and the filters
   sit two to a row. 24 screens, 72 boards. In the big canvas (the staff
   app) journey 20 replaces its three placeholders. Carried into other
   journeys: Reports' "Activity log" card (journey 17, hidden from staff
   with "Can see reports"); "Signed-in devices" and "Alerts on Today" in
   Settings › Office › Staff and roles (journeys 8 and 19); "Signed in ·
   Sign out everywhere" on every person (journeys 8, 17, 19); the Help
   cards in Your settings — "Send feedback" and "What Wheelhouse records
   about you" (journeys A and 17).

**Later change (3 Oct 2026, issue #116 question 5):** Jack, 3 Oct: "2". The activity log (decisions 1 and 5) stays in the first release. These come later: the alerts on Today (decision 2), Signed-in devices and "Sign out everywhere" (decision 3), Send feedback (decision 4 and audit H6), and the first sign-in note with "What Wheelhouse records about you" (audit H2). Removing a person still signs them out. To check before release: whether shops are required by law to tell staff what is recorded about them, which might bring the H2 note back. Chosen over all four in the first release. The drawings are not changed yet; they are redone when the canvases are merged (issue #116 step 3).

**Later change (5 Oct 2026, issue #132, `docs/decisions/2026-10-05-roles-and-switches.md`):** Jack, 5 Oct, answer 1. What decision 5 and H4 keep for owners and managers (the activity log, the three Today alerts) is also open to a Staff member given "Give everything a Manager can do".
