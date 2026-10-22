# Proposal: booking answers go at once, without the minute's Undo

## Why
Mark's 22 Oct audit (P2 3, draft #385): the messages spec says every message
staff trigger waits a minute with Undo, but the booking answers (accept,
offer, decline, a date change answered, cancel) are sent at once, as built
(#336; decided-while-building 20 Oct, booking-message-triggers item 1).
Jack, 22 Oct: "keep booking answers sending at once and correct the messages
spec." Undoing the message wouldn't undo the answer itself; a mistaken
answer is put right by offering a time again, and the customer hears at once.

## What changes
The messages spec's Undo requirement names the messages that wait (Quote to
approve and Bike ready) and says the booking answers go at once. No code
changes.
