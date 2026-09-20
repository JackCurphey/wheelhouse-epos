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

// The shortest sequence of declared events that gets a machine from one state
// to another, or null if there is no such route.
//
// Breadth-first over the machine's own transitions, so every step is a move the
// product already allows. This is deliberately not a way to reach a state the
// machine forbids - if no path exists it says so, and the caller decides what to
// do about that.
export function eventsToReach(machine, from, to) {
  if (from === to) return [];
  const seen = new Set([from]);
  const queue = [[from, []]];
  while (queue.length) {
    const [state, path] = queue.shift();
    for (const event of machine.events(state)) {
      const next = machine.next(state, event);
      if (seen.has(next)) continue;
      const took = [...path, event];
      if (next === to) return took;
      seen.add(next);
      queue.push([next, took]);
    }
  }
  return null;
}

// Walks a job to a target state along that path, one guarded applyEvent per
// step. Returns the same shape as applyEvent.
//
// Used where an outside fact tells us where a job has ended up - tendering its
// order means the work happened - and the job's recorded state has not caught
// up. Walking the declared path records how it got there instead of writing the
// destination straight to the column, which is what the old single status
// column allowed.
export async function driveTo({ jobId, machine, target, expectedVersion }) {
  const column = MACHINE_COLUMNS[machine.name];
  const job = await prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(jobId);
  if (!job) return { ok: false, code: 'not_found', message: 'Job not found' };

  const path = eventsToReach(machine, job[column], target);
  if (path === null) {
    return {
      ok: false,
      code: 'unreachable',
      message: `a job that is ${job[column]} cannot reach ${target}`,
    };
  }

  let version = expectedVersion;
  let last = { ok: true, job };
  for (const event of path) {
    last = await applyEvent({ jobId, machine, event, expectedVersion: version });
    if (!last.ok) return last;
    version = last.job.version;
  }
  return last;
}
