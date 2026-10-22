// The only place a workshop job's state changes.
//
// Two guards, and they refuse for different reasons that the caller must be
// able to tell apart. The machine refuses a move the product does not allow
// (finishing work that never started). The version refuses a move that was
// legal when the caller read the job and is not legal now, because someone else
// moved it first. The first is a bug or a stale screen; the second is an
// ordinary race between two people at two desks, and the screen's answer to it
// is "reload and look again" - which it can only offer if it knows which one
// happened.
//
// Both the read and the conditional write happen inside the caller's shop
// context, so Row-Level Security does the tenant check: a job belonging to
// another shop is not refused, it is invisible, and the caller gets
// 'not_found'. Never add an explicit shop_id comparison here - it would pass
// while RLS was broken and hide the failure the isolation tests exist to find.
import { prepare } from '../db.js';

export const MACHINE_COLUMNS = {
  bookingRequest: 'booking_state',
  custody: 'custody_state',
  work: 'work_state',
};

// Moves that start or reopen a job's life make no sense once its booking has
// ended (issue #190 A). Collecting a bike already in the shop stays allowed -
// the bike really is there (docs/decisions/2026-10-15-job-page-fixes.md, 5).
// A pending request is not ended and may still be booked in.
const ENDED_BOOKING = new Set(['cancelled', 'declined', 'expired']);
const REFUSED_ON_ENDED_BOOKING = {
  custody: new Set(['book_in']),
  work: new Set(['start', 'hold', 'reopen']),
};
const ENDED_BOOKING_VERB = { book_in: 'booked in', start: 'started', hold: 'put on hold', reopen: 'reopened' };

export async function applyEvent({ jobId, machine, event, expectedVersion }) {
  const column = MACHINE_COLUMNS[machine.name];
  if (!column) throw new Error(`no column is mapped for machine ${machine.name}`);

  const job = await prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(jobId);
  if (!job) return { ok: false, code: 'not_found', message: 'Job not found' };

  const from = job[column];
  if (!machine.can(from, event)) {
    return {
      ok: false,
      code: 'illegal',
      // Names the legal moves, because the caller's next question is always
      // "then what can I do?" and the machine already knows.
      message: `cannot ${event} a job that is ${from}; from here you can ${machine.events(from).join(', ') || 'do nothing'}`,
    };
  }

  if (ENDED_BOOKING.has(job.booking_state) && REFUSED_ON_ENDED_BOOKING[machine.name]?.has(event)) {
    return {
      ok: false,
      code: 'illegal',
      message: `This booking was ${job.booking_state}, so the job can't be ${ENDED_BOOKING_VERB[event]}.`,
    };
  }

  const to = machine.next(from, event);
  // The column name is interpolated rather than bound because Postgres cannot
  // parameterise an identifier. Safe here and only here: MACHINE_COLUMNS is a
  // closed map keyed by machine name, and an unmapped machine throws above. Do
  // not extend this pattern to a caller-supplied column.
  // When the bike came in and went (booking page stages, 21 Oct; migration 051):
  // set by the custody moves themselves, so every way a bike moves records it.
  const custodyTime = machine.name !== 'custody' ? ''
    : event === 'book_in' ? ', booked_in_at = now()'
    // A collected bike leaves its storage slot (storage slots, 22 Oct).
    : event === 'collect' ? ', collected_at = now(), storage_slot_id = NULL'
    : event === 'reopen' ? ', collected_at = NULL'
    : '';
  const { changes } = await prepare(
    `UPDATE workshop_jobs SET ${column} = ?${custodyTime}, version = version + 1, updated_at = now()
     WHERE id = ? AND version = ?`
  ).run(to, jobId, expectedVersion);

  if (changes === 0) {
    return {
      ok: false,
      code: 'stale',
      message: 'This job changed while you were looking at it. Reload and try again.',
    };
  }

  const updated = await prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(jobId);
  return { ok: true, job: updated };
}
