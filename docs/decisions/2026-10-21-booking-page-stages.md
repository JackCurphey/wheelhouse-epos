# The booking page's later stages: questions while building

The customer's booking page (the link in their messages) still shows the
first-release page once the bike is in the workshop, ready, collected or
the link has expired. These are Jack's answers on how to build those stages
while some of the server's data (Mark's lane) isn't there yet.

## Answers

1. **The in-workshop stage before the server sends the work's progress.**
   Jack, 21 Oct: "1: build the in-workshop page now with a plain 'Your bike
   is in the workshop' line, and add the step-by-step progress once Mark's
   server sends it."
2. **A request the shop never answered, once it has expired.** Jack, 21 Oct:
   "2: say the request expired because the shop couldn't get back in time,
   with a 'Choose another date' button, like the declined page."
3. **The drawings.** Jack, 21 Oct: "Approve the expired-request and collected
   booking page drawings; build the booking page stages." (`bk-request-expired`,
   `cp-summary-collected`.)
4. **Prices when "Show prices on the booking page" is off.** Jack, 21 Oct:
   "In regards to the show prices switched off, as far as I'm thinking about
   it, all it will be is that it will just have the numbers of the prices not
   visible. Everything else will still be fine. It will basically just be a
   switch that will turn that off." So the ready page's work, what was
   declined and the amount to pay still show, without their figures.
