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

  const to = machine.next(from, event);
  // The column name is interpolated rather than bound because Postgres cannot
  // parameterise an identifier. Safe here and only here: MACHINE_COLUMNS is a
  // closed map keyed by machine name, and an unmapped machine throws above. Do
  // not extend this pattern to a caller-supplied column.
  const { changes } = await prepare(
    `UPDATE workshop_jobs SET ${column} = ?, version = version + 1, updated_at = now()
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
