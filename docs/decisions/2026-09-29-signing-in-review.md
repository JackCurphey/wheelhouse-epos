# Journey B, Signing in and access — Jack's decisions (29 Sep 2026)

Journey B covers staff sign-in and account access, the till's set-up and
check-in, and customer sign-in. It is redrawn in the Soft sand look on its
own Design canvas, desktop first, following the rules that apply to every
journey (Workshop day decisions 45, 48, 50, 53, 57, 62, 65–67; journey A
decisions 2 and 6 — search on every staff page, as few clicks as possible).

Background: the WorkOS sign-in spec
(`docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`) sends
people to WorkOS's hosted AuthKit pages to sign in. WorkOS's branding
options (checked in its docs, 29 Sep): logo and favicon, button/link/
background colours, corner radius, a Google font, one- or two-column layout,
page title and link wording, legal links, and custom CSS — not a free
redesign.

1. **Journey B is next** (Jack, 29 Sep), chosen over Selling at the till and
   Collect the bike and pay.
2. **WorkOS is not set up just to see its pages** (Jack, 29 Sep). The
   WorkOS-hosted pages (sign in, reset password, check your email, new
   password, accept an invitation — and customer sign-in by emailed code,
   since customers are WorkOS users too) stay WorkOS's, as the spec plans.
   Journey B draws one board showing roughly how they will look in Soft sand,
   labelled as an approximation, and puts its design effort into the screens
   Wheelhouse owns.
3. **The till's check-in and PIN work without the internet** (proposed with
   decision 2, 29 Sep; Jack did not object): the Release 2 offline-till spec
   supersedes the WorkOS spec's "no offline sign-in path" for the till, so
   the PIN check-in cannot depend on WorkOS.
4. **Check in or take over the till by typing your PIN alone** (Jack,
   29 Sep): the PIN says who you are — no name grid first. Each person's PIN
   must be unique within the shop. The screen shows who is already checked
   in. (Chosen over name-then-PIN and name-only.)
5. **Customers sign in on the shop's own website, with Wheelhouse's own
   "email me a code" screens in the shop's theme** (Jack, 29 Sep), not on
   WorkOS's page (which is styled once for all of Wheelhouse, so it would
   not show the shop's look). WorkOS checks the code behind the scenes —
   confirmed in its docs (29 Sep): Magic Auth codes can be created and
   verified by API from your own screens; six digits, valid for 10 minutes.
   Chosen over the WorkOS page and over no customer sign-in for now.
6. **Each person sets their own till PIN in Your settings** (Jack, 29 Sep):
   a "Till PIN · Change PIN" line in the Your settings pop-up (journey A
   decision 8), so nobody else knows it. A forgotten PIN is cleared by a
   manager from the staff list (journey 8), and the person sets a new one.
   Chosen over manager-set PINs and setting it at first till use.
7. **Wheelhouse picks each person's till PIN** (Jack, 29 Sep): because PINs
   must be unique (decision 4), letting people choose would reveal a
   colleague's PIN whenever a choice clashed. Change PIN shows a new random
   4-digit PIN nobody else has, with "Give me a different one"; nobody can
   probe for others' PINs. (Chosen over 6-digit chosen PINs and going back
   to name-then-PIN.) A one-minute lock after 5 wrong PINs was proposed
   alongside — see decision 8.
8. **No lock after wrong PINs** (Jack, 29 Sep): being checked in as
   someone else at a till isn't sensitive enough to justify it — at worst a
   sale is recorded under the wrong name. The "Till paused" board is dropped.
9. **Audit fixes adopted** (Jack, 29 Sep; `docs/design/user-journeys/signin-ui-audit.md`):
   the till bar's empty state reads "Nobody serving — enter your PIN"
   (it contradicted the checked-in list); a wrong PIN clears the dots and
   says "That PIN isn't anyone's — try again" (feedback only, no lock); a
   wrong or expired customer code says so under the boxes with "Send a new
   code"; someone with only one site skips "Where are you working today?".
10. **Journey B approved** (Jack, 29 Sep: "yeah that all looks good") —
    desktop, tablet and phone. It is copied into the user journeys canvas,
    status Designed, in the Soft sand look. The booking-link pages (no
    sign-in) stay as the Release 1 designs.

**Later change (1 Oct 2026, Account, history and reminders decision 8, audit
L2):** on the customer sign-in and code boards the website header marks
"Account" as the current page (bold, underlined, announced as the current
page), as on every account page.

**Later change (1 Oct 2026, Multiple sites decisions 9 and 11):** the shop
switcher in the sidebar is named "Shop: Bolton. Choose a shop" (with its open
state) for screen readers, and on tablet and phone — where the switcher is out
of sight — the shop's name, "North Street Cycles · Bolton", sits in small type
under each staff page's title. Nothing else on these boards changed.

**Later change (2 Oct 2026, Find the shop decision 8):** every website page gains a "Skip to the main content" link before the header, and the footer reads Contact us, Collection and returns (was "Delivery and returns"), Privacy and Cookies, its links 44px tall. Nothing else changed.

**Later change (3 Oct 2026, walk-through 10 M2, `docs/design/user-journeys/walk-2/`):** Jack, 3 Oct: "1". An owner or manager can give a forgotten till PIN from their own phone: "Give a new PIN" on the person shows a one-time PIN they read out over a call, and the person changes it at check-in. This makes an exception to decision 6 ("so nobody else knows it") for a one-time PIN only. Chosen over a "Can give till PINs" switch, and keeping it in person at the till. Not drawn yet.

**Later change (3 Oct 2026, walk-through 4 M3):** Jack, 3 Oct: "1". The owner or a manager can give anyone their first PIN at the till, as they already do for till-only people, with the screen turned to the person. The till reads "No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here." Chosen over a line in the invite asking them to sign in on their phone first. Not drawn yet.

**Later change (3 Oct 2026, third walk, answers 8 and 9, `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md`):** Jack, 3 Oct: "1" to each. A customer's sign-in link carries the page it came from, so after the code that page opens (the receipt from the receipt email). A workshop computer's "Enter your PIN" is drawn, with no till number. Nothing else changes. Drawn in `docs/superpowers/specs/2026-10-03-draw-the-third-walk.md`.

**Later change (5 Oct 2026, issue #132, `docs/decisions/2026-10-05-roles-and-switches.md`):** Jack, 5 Oct, answers 1 and 5. Giving a first or new PIN is for owners, managers and anyone given "Give everything a Manager can do"; clearing a forgotten PIN also for anyone with "Can change settings" (Owner setup 10). Nobody clears or gives their own, and the proposed rule in the WP-1.1 table keeps the Owner's PIN to the Owner. Adding or removing people, changing roles or switches and registering tills need an email sign-in, never a PIN on a shared computer (answer 2).

**Later change (7 Oct 2026, stage 1 drawing check, `docs/decisions/2026-10-07-stage-1-drawing-gaps.md`):** Jack, 7 Oct: "lets do just google for now, but once we start getting money in then we will be getting apple too". Customer sign-in (decision 5) adds "Continue with Google" beside the emailed code, on Wheelhouse's own screens in the shop's theme; WorkOS handles it (social login is in its free tier, checked 7 Oct). The emailed code stays for everyone else. Sign in with Apple comes once the business has income: it needs the paid Apple Developer Program ($99 a year). Jack said yes to the real Google sign-in setup the same day; Google's screen names it "Wheelhouse". Until the WorkOS account exists it is built against a pretend version, then tested with WorkOS's staging Google keys. Google returns people to WorkOS's own address, so shops' web addresses need no registering with Google. Not drawn yet.
