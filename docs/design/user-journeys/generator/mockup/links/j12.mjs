// Journey 12, Workshop day — where each button goes in the mockup.
import { go, STAY, outside, notDrawn } from '../controls.mjs';

// The job page's own controls, on every stage of the job (job-page.mjs).
const JOB = {
  'Add item': notDrawn('The job’s Add item search: the shop’s services and products'),
  'Scan barcode': STAY,
  'Notes': STAY,
  'Message Maya Patel': go('ac-inbox'),
  'Email Maya Patel': outside('An email to Maya Patel, from the shop’s email app'),
  'Full service checklist 0 of 10 done · 0 notes': go('job-checklist'),
  'Full service checklist 8 of 10 done · 1 note': go('job-checklist'),
};

const SHOWING = { 'Showing Everyone. Change whose jobs are shown': STAY };

const NEW_JOB = {
  '+ Add a bike': notDrawn('Adding a bike for the customer, from New job'),
  '+ New customer': go('cs-add'),
  'Add note': STAY,
  'Search services': STAY,
  'Find the next free 60 minutes': STAY,
  'Save job': go('job-overview'),
};

export default {
  '*': { ...SHOWING, 'Previous day': STAY, 'Next day': STAY },
  'diary': SHOWING,
  'diary-day': { 'Showing By mechanic. Change whose jobs are shown': STAY },
  'diary-settings': {
    '+ Add a slot': STAY,
    'Remove Front window': STAY, 'Remove Workshop floor': STAY,
    'Remove Hook 1': STAY, 'Remove Hook 2': STAY, 'Remove Hook 3': STAY,
    'Remove Hook 4': STAY, 'Remove Hook 5': STAY, 'Remove Hook 6': STAY,
  },
  // Requests, as a pop-up
  'request-new': {
    'Accept': go('diary'),
    'Offer another time': notDrawn('Offer another time: choosing the time to suggest to the customer'),
    'Another time': notDrawn('Offer another time: choosing the time to suggest to the customer'),
  },
  'request-decline': { 'Decline & notify customer': go('diary'), 'Keep request': go('request-new') },
  'request-change': { 'Accept': go('diary'), 'Decline': go('diary') },
  'request-cancel': { 'Seen': go('diary') },
  // New job
  'new-job': NEW_JOB,
  // The job
  'job-overview': JOB,
  'job-quote': { 'Send quote': go('dq-job-sent') },
  'job-waiting-parts': { 'Mark ready for collection': go('job-finished') },
  'job-finished': { 'Undo': go('job-mechanic') },
  'job-collection': { 'Hand over': go('cp-collected') },
  'job-checklist': {
    ...JOB,
    // A workshop computer's PIN screen is till-checkin (its line: Walk-through 8, decision 1).
    'Switch': go('till-checkin'),
    'Add a note for Bolts torqued': STAY, 'Add a note for Bottom bracket': STAY,
    'Add a note for Cables & housing': STAY, 'Add a note for Chain & drivetrain': STAY,
    'Add a note for Frame & fork': STAY, 'Add a note for Gears indexed': STAY,
    'Add a note for Headset': STAY, 'Add a note for Tyre pressure': STAY,
    'Add a note for Wheels & tyres': STAY,
  },
};
