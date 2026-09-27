'use strict';
// Wording for the staff diary's review pop-up. Needs diary-waiting.js loaded
// first. Sets globalThis.DiaryReview (see diary-waiting.js).
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
(function () {
  const { dayDate, slotText } = globalThis.DiaryWaiting;

  const HEADINGS = {
    new_booking: 'New online booking',
    change_request: 'Change request',
    customer_cancelled: 'Cancelled by customer',
  };

  function headingFor(item) {
    return HEADINGS[item.kind] + (item.reference ? ` · ${item.reference}` : '');
  }

  function answerText(entry) {
    let main;
    if (entry.answer && typeof entry.answer === 'object' && entry.answer.notSure) main = 'Not sure';
    else if (entry.answer === null || entry.answer === undefined || entry.answer === '') main = '';
    else main = String(entry.answer);
    const extra = entry.text || '';
    if (main && extra) return `${main} — ${extra}`;
    return main || extra || 'No answer';
  }

  // Answers whose service has since left the booking still show, last.
  function groupAnswers(answers, services) {
    const list = answers || [];
    const groups = services
      .map((s) => ({ name: s.name, answers: list.filter((a) => a.serviceId === s.id) }))
      .filter((g) => g.answers.length);
    const known = new Set(services.map((s) => s.id));
    const rest = list.filter((a) => !known.has(a.serviceId));
    if (rest.length) groups.push({ name: 'Other answers', answers: rest });
    return groups;
  }

  function changeLine(item) {
    return `Customer asked to move from ${slotText(item.from)} to ${slotText(item.to)}`;
  }

  function declineConfirmText(item) {
    const whose = item.customerName ? `${item.customerName}'s` : 'this';
    return `Decline ${whose} booking for ${dayDate(item.jobDate)}? This can't be undone.`;
  }

  // err comes from app.js api(): status and code are set for a server answer;
  // a request that never reached the server has neither.
  function refusalText(err) {
    if (err.code === 'stale') return 'This job changed while you were looking at it.';
    if (err.code === 'capacity') return 'The requested time is no longer free.';
    if (err.status === 404) return 'This job no longer exists.';
    if (err.status === undefined) return "Couldn't reach the server — try again.";
    return err.message;
  }

  globalThis.DiaryReview = { headingFor, answerText, groupAnswers, changeLine, declineConfirmText, refusalText };
})();
