'use strict';
// "Waiting for you" card wording for the staff diary (public/app.js).
// A plain script: sets globalThis.DiaryWaiting, which app.js reads and
// tests/diary-rules.test.js loads through vm.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
(function () {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Worked out in UTC from the date's own digits, so the machine's time zone
  // can't move it to the day before.
  function dayDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${DAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
  }

  function slotText(slot) {
    if (!slot || !slot.jobDate) return '';
    let text = dayDate(slot.jobDate);
    if (slot.startTime) text += `, ${slot.startTime}${slot.endTime ? `–${slot.endTime}` : ''}`;
    if (slot.mechanicName) text += ` · ${slot.mechanicName}`;
    return text;
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  function arrivedText(arrivedAt, now) {
    const minutes = Math.floor((now.getTime() - new Date(arrivedAt).getTime()) / 60000);
    if (minutes < 1) return 'Arrived just now';
    if (minutes < 60) return `Arrived ${plural(minutes, 'minute')} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Arrived ${plural(hours, 'hour')} ago`;
    return `Arrived ${plural(Math.floor(hours / 24), 'day')} ago`;
  }

  function moveText(from, to) {
    const end = (s) => `${dayDate(s.jobDate)}${s.startTime ? ` ${s.startTime}` : ''}`;
    const withWho = to.mechanicId !== from.mechanicId && to.mechanicName ? ` with ${to.mechanicName}` : '';
    return `${end(from)} → ${end(to)}${withWho}`;
  }

  const KINDS = {
    new_booking: { tone: 'new', label: 'New booking' },
    change_request: { tone: 'change', label: 'Change request' },
    customer_cancelled: { tone: 'cancelled', label: 'Cancelled by customer' },
  };

  function cardFor(item, now) {
    const kind = KINDS[item.kind];
    return {
      tone: kind.tone,
      label: kind.label,
      customer: item.customerName || 'Customer',
      reference: item.reference || '',
      services: (item.serviceNames || []).join(', '),
      when: item.kind === 'change_request' ? moveText(item.from, item.to) : slotText(item),
      arrived: arrivedText(item.arrivedAt, now),
    };
  }

  globalThis.DiaryWaiting = { dayDate, slotText, arrivedText, moveText, cardFor };
})();
