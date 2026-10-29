# Design: The look at closing on a normal day

## The contract

No new routes, fields or migration. `GET /api/close-the-day` and
`POST /api/close-the-day` work out `expectedPence`, `cashPence` (the cash the
expected figure added), `paidOutsPence` and `paidOuts` differently when
today's only float check is the Owner's look at closing (no count, nobody
checked in at a till: `closingLook`, as the unclosed-day money review
defined it).

## Decisions

1. **The window starts at the last close** (Jack's 29 Oct answer 7): the
   float (the look), plus the cash sales since the last close was made, less
   the cash taken out since then dated from the day after that close's day,
   less any cash banked since for an earlier day. The same window a day
   nobody closed uses for such a look (`drawer`'s `previousClose`), so the
   two can't count a sale or a paid-out differently.
2. **A shop's first close** has no last close: the window starts at the
   start of today, by the shop's clock, as Close the day already starts
   counting sales at its first close's day (close-the-day design 6); cash
   taken out is today's only.
3. **No double count with a day nobody closed:** a look at closing makes no
   count for an earlier day (unclosed-day design 3), so no day waits, and
   tonight's close counts every uncounted sale once, as before; its expected
   figure now includes the earlier day's cash too, which is in the drawer.
4. **Locks unchanged:** the close still locks the shop's row first, reads,
   marks and writes, and replies after COMMIT.
5. **After a late Close it** (money review of #584): when the last close
   was made after a later day's morning count, the drawer then held that
   count's cash too, so the window starts at that count (its figure, its
   time, cash taken out from its day), and the banking since comes off.
   The same for a day nobody closed whose only check is a look. "Float this
   morning" and the report's "Float at the start" show that figure.
6. **Exact times** (money review of #584): every time read back only to be
   compared (a check's, a count's, a close's) stays the database's own text,
   to the microsecond; a JavaScript date keeps only milliseconds, and the
   last close looked to be after itself.
