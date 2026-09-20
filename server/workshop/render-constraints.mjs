// server/workshop/render-constraints.mjs
//
// Renders each state machine as a Postgres CHECK constraint. The output is
// pasted into a migration and committed, so the SQL a reviewer reads is the SQL
// that runs - no generation at migration time, no surprises.
//
// tests/workshop-state-drift.test.js re-runs this and fails if a committed
// migration no longer matches its machine, which is the only thing stopping the
// model and the database from quietly diverging.
//
// Run it to print every constraint:  node server/workshop/render-constraints.mjs
import {
  bookingRequest, custody, work, quote, capacityHold, printTask, messageIntent,
} from './state-machines.js';

export function checkConstraint(machine, column) {
  const values = machine.states.map(s => `'${s}'`).join(', ');
  return `CHECK (${column} IN (${values}))`;
}

// Which machine belongs to which column, in which migration. The drift test
// walks this, so a machine missing from here is a machine nothing checks.
export const MIGRATION_COLUMNS = [
  { machine: bookingRequest, column: 'booking_state', migration: '016_workshop_job_states.sql' },
  { machine: custody, column: 'custody_state', migration: '016_workshop_job_states.sql' },
  { machine: work, column: 'work_state', migration: '016_workshop_job_states.sql' },
  { machine: quote, column: 'state', migration: '017_workshop_quotes.sql' },
  { machine: capacityHold, column: 'state', migration: '018_workshop_capacity_holds.sql' },
  { machine: printTask, column: 'state', migration: '019_workshop_print_tasks.sql' },
  { machine: messageIntent, column: 'intent_state', migration: '020_message_intent_state.sql' },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const { machine, column, migration } of MIGRATION_COLUMNS) {
    console.log(`-- ${migration}: ${machine.name}`);
    console.log(`  ${checkConstraint(machine, column)}`);
  }
}
