'use strict';
// How the staff diary grid draws a job, and where a change request's dashed
// outline goes. Sets globalThis.DiaryMarks (see diary-waiting.js).
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
(function () {
  const GONE = ['cancelled', 'declined', 'expired'];

  function markOf(job) {
    const state = job.bookingState;
    if (state === 'reschedule_requested' && job.requested) return 'move-requested';
    if (state === 'cancelled' && job.cancelledBy === 'customer' && !job.cancellationSeenAt) return 'cancelled-unseen';
    if (GONE.includes(state)) return 'hidden';
    return 'normal';
  }

  // Drawn from the waiting list, which is shop-wide: a job booked in another
  // week can still ask for a time in this one.
  function outlinesOn(items, dateStr, mechanicOk) {
    return items.filter((i) => i.kind === 'change_request' && i.to && i.to.jobDate === dateStr
      && i.to.startTime && mechanicOk(i.to.mechanicId));
  }

  globalThis.DiaryMarks = { markOf, outlinesOn };
})();
