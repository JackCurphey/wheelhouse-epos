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
