// The mechanic sign-off (Jack, 16 and 18 Oct,
// docs/decisions/2026-10-16-mechanic-sign-off.md; migration 040). Finishing
// the work records who signed it off and when; reopening clears it, the
// earlier sign-off kept in workshop_job_sign_offs, marked cleared.
import { prepare } from '../db.js';

export const SIGN_OFF_REQUIRED = { error: 'Choose who is signing this off', code: 'sign_off_required' };

// An active mechanic of this shop (row security keeps other shops' out), or null.
export async function signOffMechanic(raw) {
  if (!Number.isInteger(raw)) return null;
  const row = await prepare('SELECT id FROM employees WHERE id = ? AND active = 1 AND is_mechanic = 1').get(raw);
  return row ? row.id : null;
}

export async function recordSignOff(jobId, employeeId) {
  await prepare('UPDATE workshop_jobs SET signed_off_by = ?, signed_off_at = now() WHERE id = ?').run(employeeId, jobId);
  await prepare('INSERT INTO workshop_job_sign_offs (workshop_job_id, employee_id) VALUES (?, ?)').run(jobId, employeeId);
}

export async function clearSignOff(jobId) {
  await prepare('UPDATE workshop_jobs SET signed_off_by = NULL, signed_off_at = NULL WHERE id = ?').run(jobId);
  await prepare('UPDATE workshop_job_sign_offs SET cleared_at = now() WHERE workshop_job_id = ? AND cleared_at IS NULL').run(jobId);
}
