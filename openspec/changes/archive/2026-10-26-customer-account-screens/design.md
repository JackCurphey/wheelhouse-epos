# Design: the customer's account, the screens

## Decisions

### 1. The data
- **`GET /me`** adds `phone` and the four contact choices:
  - `updateChannel` ('sms' or 'email');
  - `serviceReminders`;
  - `reviewRequests`;
  - `marketingPermission`.
- **`GET /history`** adds, for a repair, `bikeId` and `workStarted`.
  `workStarted` is true once the work has begun, for the tracker's "Being
  worked on".
- **Reads:** the account reads `/me`, `/bikes` and `/history` with React
  Query. A 401 on any of them means signed out.

### 2. The page: `src/screens/book/account.tsx`, at `ACCOUNT_ROUTE`
`ACCOUNT_ROUTE` is `/book/:shopSlug/account`, registered as `SIGNIN_ROUTE`
is. The page sits in `BookFrame` with the title "Your account".

**At the top:** the name and email, with "Sign out" (`POST /logout`, then the
shop's booking page), and "Book a repair" (`/book/:shopSlug`).

**On a computer,** two columns as drawn:
- **left:** bikes, then details;
- **right:** the history.

On a phone the order is bikes, history, details.

**Bikes:**
- each bike's make, model and colour;
- "In the shop now · WH-[n]" while a repair of that bike is in the workshop
  or ready to collect;
- "Book a repair";
- empty: "No bikes yet. Add one to book it in faster."

**Details:** Name, Mobile, Email. Then "How we contact you":
- Job updates, "By text" or "By email";
- Service reminders, On or Off;
- Review requests, On or Off;
- Offers and news, On or Off.

**History:**
- the pills Everything, Repairs and Purchases;
- "Now" for repairs not yet collected, cancelled, declined or expired;
- "Earlier, newest first", eight shown, then "Show more".

**A repair row:** "Repair", then "WH-[n] · [bike] · [title]".
- **Under it:** now: "Booked in [date]"; past: "[date] · collected".
- **On the right:** now: the tracker's chip (Booked, In the shop, Being
  worked on, Ready); past: "£[total]" when it's known.
- **It opens** `/book/:shopSlug/booking/job-<id>`.

**A purchase row:** "Purchase", then "[receipt number or no.] · [what]".
- **Under it:** "[date] · in the shop".
- **On the right:** "£[total]".
- **It opens** nothing yet: no receipt pop-up.

**Empty history:** "Nothing here yet. Your repairs and purchases with [shop]
show here." and "Book a repair".

### 3. Signed out, and after sign-in
- **Signed out:** the account sends people to
  `/book/:shopSlug/sign-in?from=/book/:shopSlug/account`.
- **After sign-in with no `from`:** `returnTo` goes to the account, not
  `/book/:shopSlug`.

### 4. Not drawn, or left out (logged)
- **The left-out parts** listed in the proposal.
- **A purchase's number:** the receipt number when there is one, otherwise
  "No. [id]". There's no till code yet for the drawn "B1-[0000]".
- **The tracker's chip** comes from the stage and `workStarted`.
