# Design: next service due

## 1. Which date
- **The date:** the day the bike's waiting service reminder goes
  (`customer_messages`, `template_key = 'service_reminder'`, still
  `intended`, a finite `send_after`). It's read as the shop's local date.
  This is the reminder's own day: the collection date plus the service's
  months, moved to the first open day. Not drawn exactly (`[date]`); logged.
- **Which reminder:** the one from a job of this bike. One per bike is kept
  (service-reminder-send answer 3); if there are several, the soonest.

## 2. The route
- **`GET /api/portal/:shopSlug/bikes`** adds `nextServiceDue` ("YYYY-MM-DD"
  or null), from one query per request.
- **No date while reminders are off:** the route gives none when the
  customer's `service_reminders` is off, so the page never shows a stale
  one.

## 3. The page
- **The words:** "Next service due Wed 17 Mar 2027", with the year always
  shown, since it is months away.
- **With a repair in:** joined to "In the shop now · WH-[n]" with " · next
  service due …", as drawn.
- **Only while `me.serviceReminders` is on.**
