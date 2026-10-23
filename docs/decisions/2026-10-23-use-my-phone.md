# Use my phone: a quote line's photo from a phone

Jack decided on 3 Oct (`2026-10-03-ux-walkthrough-8.md` decision 6) that on a
computer, a quote line's "Add photo" offers "Choose a file" and "Use my
phone", and that "Use my phone" shows a code to scan which opens that one
line's photo step on the phone, with no sign-in. It was never drawn, and
nothing said how long the code lasts, how many photos it takes, or how the
computer learns the photo has arrived.

## Answer

1. **The drawings are approved as drawn.** Jack, 23 Oct: "the 7 drawings
   look good too." Drawn in journey 12:
   - `job-photo-choice`: Add photo's two choices on a computer.
   - `job-photo-phone`: the code to scan, waiting for the photo.
   - `job-photo-phone-added`: the same pop-up once the photo arrives.
   - `phone-photo-ready`, `phone-photo-check`, `phone-photo-done` and
     `phone-photo-expired`: the phone's photo step, with no sign-in.

2. **The details shown in them stand:**
   - The code works for 15 minutes, for one photo on that one line. After a
     photo is added it stops working.
   - The computer's pop-up updates by itself when the photo arrives.
   - The phone page shows the shop's name, the job's reference, the bike,
     the line and its reason, and nothing else about the customer (no name
     or phone number).
   - On a tablet or phone, Add photo goes straight to the camera or file
     picker, as now.

Built in WP-4.1. The page without sign-in is a public route, one of the
working agreement's four risky areas, so it gets `/review` before merging.
