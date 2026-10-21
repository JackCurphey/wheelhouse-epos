// A fake workshop job with every field the server sends (src/lib/api/shapes.ts,
// WORKSHOP_JOB), so a screen test states only the fields it cares about and
// the rest stay the shape of the real reply. Unset fields are empty, as on a
// fresh staff job; nothing here is example data.
export function fakeJob(over = {}) {
  const j = {
    id: 1, title: '', reference: '', version: 1,
    customerId: null, customerName: null, bikeId: null, bikeLabel: null, bikeColour: null,
    mechanicId: null, mechanicName: null, jobDate: '', startTime: null, endTime: null,
    status: 'scheduled', bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', newOnline: false,
    notes: null, questionAnswers: null, customerDescription: null, customerBikeNote: null, requested: null, offer: null,
    cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, changeDeclinedAt: null,
    orderId: null, orderStatus: null, orderTotal: null, quote: null,
    signedOffBy: null, signedOffByName: null, signedOffAt: null,
    createdAt: '', updatedAt: '', ...over,
  };
  // The server sends every job's days; a one-day job has one: its own date, time and mechanic.
  return {
    parts: [{ id: j.id * 10 + 1, position: 1, date: j.jobDate, startTime: j.startTime || '', endTime: j.endTime || '', mechanicId: j.mechanicId, mechanicName: j.mechanicName }],
    ...j,
  };
}
