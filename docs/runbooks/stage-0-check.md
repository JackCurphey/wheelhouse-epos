# Stage 0's check: walking booking, the diary and the till (for Jack)

The last line of stage 0 (split plan §9, line 7): walk the journeys stage 0
touched, in the real app, and say whether each one works as a story. Do it on
the hosted test copy once the test shop is loaded (runbook, "Loading the test
shop") and you have its login. The names below are the drawings' own example
customer and shop.

Tick a line when what you see matches. Where it doesn't, write what you saw
next to it: a broken story is fixed before stage 1 starts, anything smaller
becomes a task.

## Before you start

- Sign in to the test copy with the test shop's login, on a laptop.
- Have a phone, or a private browser window, for the customer's side.
- Deposits and "Confirm bookings automatically" stay off (as they start), so
  an online booking arrives as a request for you to answer.

## 1. A customer books a repair online (the customer's side)

On the phone, open `https://<test copy address>/book/north-street-cycles`.

- [ ] "What do you need?", with "Full services", "Individual services" and
      "Not sure". Every page says "Step N of 4".
- [ ] Choose **Full services**, then **Standard service** (£65.00), then
      **Continue**.
- [ ] "Tell us about your bike": type **Trek Domane AL 3**, then **Continue**.
- [ ] "When can you drop in?": pick a day this week, then a free time, then
      **Continue**.
- [ ] "How can we reach you?": **Maya Patel**, mobile **07700 900 142**, updates
      by **Text message**. Open "Read the booking terms", tick "I agree to the
      booking terms", then press **Request booking**.
- [ ] You land on "Your booking request" with "Waiting for the shop to
      confirm", and the service, bike and time you chose.
- [ ] **Copy link** copies the page's address. Keep it for part 2.

## 2. Answering it in the diary (the shop's side)

On the laptop, open **Diary**.

- [ ] "Waiting for you" has a "New booking request" from Maya Patel, and the
      diary shows the request as a "Pending" block at the time she chose.
- [ ] Open it (click the card, then **Open**). It shows what she told you,
      and a mechanic to choose. Press **Accept**.
- [ ] The block now reads "Expected". On the phone, refresh her page: "Booking
      confirmed".
- [ ] Click the block to open the job. Press **Book in**, then **Start work**.
      The job's badge says "In the workshop".
- [ ] Press **Mark ready for collection**. "Who's signing this off?": pick a
      mechanic, then **Sign off and mark ready**.
- [ ] The badge says "Finished", with "Signed off by [name]". The strip says
      "Bike ready" goes to Maya by text in 1 minute, with **Undo**. Texts are
      pretend on the test copy, so nothing reaches a phone.
- [ ] The diary block turns green, "Finished".

## 3. Paying at the till

- [ ] On the finished job, press **Take payment**. The till opens with
      "Workshop job [reference]" and the job's lines. "Bike collected when
      paid" is on.
- [ ] Press **Take payment · £65.00**, then **Card · £65.00**, then **Card
      approved**. The card is pretend: nothing connects to a card machine.
- [ ] "Paid", "Card · £65.00 · Sale [n]", with **Print** and **No receipt**,
      and "Next sale starts in 5 seconds". **Print** prints the receipt.
- [ ] Back on the job: its badge says "Collected".
- [ ] A shop sale: on the till, tap a service under "Workshop" (or search for
      **Shimano brake pads**, £28.00), press **Take payment**, then **Cash**.
      Tap a note, check "Change to give", then **Cash taken**. "Paid" shows the
      change.

## When it's done

Tell Claude (or Mark) what didn't match. Each mismatch is either fixed
before stage 1 or written down as a task; the stage check's issue gets its
lines ticked.
