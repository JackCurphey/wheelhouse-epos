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
   to name-then-PIN.) Proposed alongside and not objected to: **the till
   locks for a minute after 5 wrong PINs in a row**, so PINs can't be
   guessed by trying every number.
