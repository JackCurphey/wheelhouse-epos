// A fake workshop job with every field the server sends (src/lib/api/shapes.ts,
// WORKSHOP_JOB), so a screen test states only the fields it cares about and
// the rest stay the shape of the real reply. Unset fields are empty, as on a
// fresh staff job; nothing here is example data.
//
// Every fake is checked against the shape as it is made, so a test that
// fakes a field the server doesn't send, or the wrong type, stops at once
// rather than passing against a reply that can't happen. Needs `npm run
// pretest`, as every screen test does.
import { WORKSHOP_JOB, WORKSHOP_JOB_CHANGED, JOB_PART, shapeProblems } from '../../.test-build/lib/api/shapes.js';

function checked(shape, job, what) {
  const problems = [...shapeProblems(shape, job), ...(job.parts ?? []).flatMap((p) => shapeProblems(JOB_PART, p))];
  if (problems.length) throw new Error(`${what} ${job.reference || job.id} isn't the shape the server sends: ${problems.join('; ')}`);
  return job;
}

export function fakeJob(over = {}) {
  const j = {
    id: 1, title: '', reference: '', version: 1,
    customerId: null, customerName: null, bikeId: null, bikeLabel: null, bikeColour: null,
    mechanicId: null, mechanicName: null, jobDate: '', startTime: null, endTime: null, plannedMinutes: null, storageSlotId: null, storageSlotName: null,
    status: 'scheduled', bookingState: 'scheduled', custodyState: 'expected', workState: 'not_started', newOnline: false,
    notes: null, questionAnswers: null, customerDescription: null, customerBikeNote: null, requested: null, offer: null,
    cancelledBy: null, cancelledAt: null, cancellationSeenAt: null, changeDeclinedAt: null,
    orderId: null, orderStatus: null, orderTotal: null, quote: null,
    signedOffBy: null, signedOffByName: null, signedOffAt: null,
    createdAt: '', updatedAt: '', ...over,
  };
  // The server sends every job's days; a one-day job has one: its own date, time and mechanic.
  return checked(WORKSHOP_JOB, {
    parts: [{ id: j.id * 10 + 1, position: 1, date: j.jobDate, startTime: j.startTime || '', endTime: j.endTime || '', mechanicId: j.mechanicId, mechanicName: j.mechanicName }],
    ...j,
  }, 'Fake job');
}

// A job as an edit or an action sends it back (WORKSHOP_JOB_CHANGED): no days.
export function changed(job) {
  const { parts: _days, ...rest } = job;
  return checked(WORKSHOP_JOB_CHANGED, rest, 'Fake changed job');
}
