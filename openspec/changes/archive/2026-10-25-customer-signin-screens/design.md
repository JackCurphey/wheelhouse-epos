# Design: the sign-in screens

## Decisions

1. **One screen, two steps.** `SIGNIN_ROUTE = '/book/:shopSlug/sign-in'` is
   joined in beside the photo and stop pages (`app-shell.tsx`). It uses
   `BookFrame` with no step number, as the stop page does. The website
   frame isn't built.
2. **The email step.** A form with Email (`type="email"`,
   `autocomplete="email"`) and "Email me a code". Enter sends it too.
   - Any refusal (a bad email, too many asks, not switched on) shows the
     server's words in an alert under the field.
3. **The code step.** One `<input>` with:
   - `aria-label="Your 6-digit code"`, `autocomplete="one-time-code"`,
     `inputMode="numeric"`, `maxLength={6}`;
   - digits only, so a pasted "481 296" fills all six;
   - six boxes drawn under it, which screen readers don't hear.

   The sixth digit sends the check.
   - **A refusal** shows its words under the boxes in an alert, and sets
     `aria-invalid` with `aria-describedby`.
   - **"Send a new code"** asks again, empties the boxes and says "We sent
     a new code to [email]" (not drawn). When the code has expired it is
     bold, as drawn.
   - **"Use a different email"** goes back to the email step, keeping what
     was typed.
4. **Where sign-in returns to.** `?from=` is read as an address on this
   site. It is used only when its path is `/book/[this shop]` or under it;
   anything else goes to `/book/[this shop]`. A link can't send someone to
   another site or another shop's pages.
