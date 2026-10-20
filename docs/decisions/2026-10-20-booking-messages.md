# The booking messages' wording (20 Oct 2026)

Nothing texts or emails a customer about a booking yet: the messages engine
(WP-1.8, Mark's) isn't built. Settings › Messages lists six booking messages
(`setup.mjs` `BOOKING_MSGS`; Book a repair decision 12, 1 Oct), and two had
draft wording as written lines (Build-plan questions Q9, 3 Oct). Jack chose
to draw the wording first (20 Oct: "1: draw the six booking messages' wording
and their edit box for my approval; sending waits for the messages engine.").

1. **The six booking messages each get an edit box, as Bike ready's**
   (`set-msg-edit`): the wording, what it can put in, a text preview and an
   email preview (stage 1 drawing gaps, decision 24), and "Go back to
   Wheelhouse's wording". Drawn as `bk-msg-request`, `bk-msg-confirmed`,
   `bk-msg-offered`, `bk-msg-declined`, `bk-msg-change` (two wordings: the
   shop accepts, or can't) and `bk-msg-cancelled`, for Jack's approval.
   Booking confirmed's 3 Oct draft now says when to drop the bike off and
   the shop's own note (19 Oct decisions), instead of "bring your bike at
   11:30". No deposit wording yet; it comes with deposits.
2. **Idea for later, for Mark's opinion: replying to a text as a shop
   setting** (Jack, 20 Oct: "Maybe we can edit this as a kind of setting, and
   a shop can choose whether their personalized number is replyable or they
   can effectively just choose a cheaper option where they have to reply
   within the link. Not something we necessarily need to build now. Maybe
   just something to note and flag for Mark for his opinion"). Today every
   shop sends from one shared Twilio number and the app can't receive texts
   (Workshop day 2, 27 Sep), so every text ends "Replies to this number
   aren't read — reply on your page: [link]" (Account and reminders
   decision 3, 1 Oct, unchanged). The idea: a shop could choose its own
   number whose replies land in its Wheelhouse inbox (a monthly cost per
   number, and receiving texts to build), or keep the cheaper shared number
   with replies on the booking page. Not built; flagged for Mark in the
   status file.
3. **The note on the confirmation stays the one place to write it, and the
   booking-confirmed text puts it in automatically** (Jack, 20 Oct: "1: keep
   both, linked: the note box stays the one place to write it, and the text
   includes it automatically."), through the "Your note on the confirmation"
   tap-in, as drawn in `bk-msg-confirmed`. Chosen over the note on the page
   only, and dropping the note box.
