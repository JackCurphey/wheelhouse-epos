// Wheelhouse EPOS - the words customers read in the booking portal.
//
// Kept in its own file, out of the render functions in portal.js, for two
// reasons: the wording is a shop-facing decision that changes more often
// than the code around it, and tests/portal-copy.test.js can then check it
// against the server's own JOB_STATUSES without a DOM or a bundler.
//
// Loaded by a plain <script> tag before portal.js - no build step, same as
// the rest of this bundle.
'use strict';

globalThis.PortalCopy = {
  // The server's workshop_jobs.status enum (server/server.js JOB_STATUSES),
  // translated for the person who owns the bike rather than the person
  // working on it. Staff see the raw statuses in their own diary; customers
  // must never see 'waiting_parts' with an underscore in it.
  //
  // Explanations state only what the system actually knows. None of them
  // promise a phone call, a time, or a next step the software does not
  // itself perform.
  JOB_STATUS: {
    pending: {
      label: 'Waiting to be confirmed',
      explanation: 'The shop has your request and will confirm it.',
    },
    scheduled: {
      label: 'Confirmed',
      explanation: 'Booked in the workshop diary for the time shown.',
    },
    waiting_parts: {
      label: 'Waiting for parts',
      explanation: 'Work has started but a part is still on order.',
    },
    on_hold: {
      label: 'On hold',
      explanation: 'Paused by the shop for now.',
    },
    complete: {
      label: 'Finished',
      explanation: 'Work on this booking is done.',
    },
  },

  // Defensive fallback for a status this file has not been taught yet.
  // tests/portal-copy.test.js fails the build when JOB_STATUS falls behind
  // the server's JOB_STATUSES, so this should never fire - but if it ever
  // does, a customer sees "Waiting parts", not "waiting_parts".
  statusFor(status) {
    const known = this.JOB_STATUS[status];
    if (known) return known;
    const words = String(status || '').replace(/_/g, ' ').trim();
    return { label: words ? words[0].toUpperCase() + words.slice(1) : 'Unknown', explanation: '' };
  },

  // PORTAL_JOB_TYPES already sends minutes (30/60/120) and portal.js already
  // uses them to check a job fits before closing - this is what puts that
  // number in front of the customer choosing, instead of only in the error
  // they hit afterwards.
  formatDuration(minutes) {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) return '';
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    const parts = [];
    if (hours) parts.push(hours === 1 ? '1 hour' : `${hours} hours`);
    if (rest) parts.push(rest === 1 ? '1 minute' : `${rest} minutes`);
    return parts.join(' ');
  },
};
