// Journey 12, The workshop diary and the job — one-canvas plan (issue #116 step 3).
// Source: ../../consolidation-12-21.md merge table. Per-screen decision
// references are from that table's "Decision touched" column, matched to each
// screen by the decision named in its diary.mjs comment.
import { keep, into } from './plan.mjs';

export default {
  // The diary
  'diary': keep(23, { sizes: ['desktop', 'tablet', 'phone'] }), // rule 3: touch blocks on tablet, day strip on phone (consolidation-12-21.md)
  'diary-mechanic': into('diary', 'Workshop day 13', "Alex Morgan's diary: 'Me' / 'Everyone' switch, opens on Me; no Waiting column"),
  'waiting-open': into('diary', 'Workshop day 14', "Sam Reed's card ringed with 'Open'; Friday's pending block highlighted; 'Double-click a card to open it.'"),
  'diary-day': keep(23, { sizes: ['desktop', 'tablet', 'phone'] }), // its layout changes (Workshop day 18); rule 3 as diary
  'diary-settings': into('set-workshop-diary', 'Owner setup 12', "The same Settings › Workshop page with 'Diary blocks' and 'Storage slots' open, for a Manager"),
  'change-selected': into('diary', 'Workshop day 19', "Oliver Chen's change card selected: requested 14:00 ringed, current 10:00 lightly marked"),
  'diary-context-menu': into('diary', 'Workshop day 37', "Right-click a block: 'Open job' or 'View overview' (press and hold on touch)"),
  'job-quick-overview': keep(25),
  'diary-stack-hover': into('diary', 'Workshop day 59, 61', "Hovering Thursday's 09:00 stack fans its jobs out in place, two per row"),
  'diary-stack-open': into('diary', 'Workshop day 59, 61', "Clicking a stack: '2 jobs at 09:00' popover of blocks, choose one to open"),
  'diary-hover-summary': into('job-quick-overview', 'Workshop day 65', "Hovering a block opens the summary as a card beside it (notes, line items, the agreed total)"),
  // Requests, as a pop-up
  'request-new': keep(9),
  'request-decline': into('request-new', 'Workshop day 15', "'Decline booking request': message to Sam; 'Decline & notify customer' or 'Keep request'"),
  'request-change': into('request-new', 'Workshop day 15', "Oliver Chen: 'Mon 14 Sep · 10:00' → '14:00'; 'Accept', 'Decline', 'Open full job'"),
  'request-cancel': into('request-new', 'Workshop day 15', "Aisha Khan's 'Cancelled booking': nothing to decide, one button 'Seen'"),
  // New job from an empty slot
  'new-job-pick': into('diary', 'Workshop day 22', "After 'New job': button reads 'Choose a time'; 'Click a free time in the diary'; free times tinted"),
  'new-job': keep(9),
  'new-job-day': into('new-job', 'Workshop day 18, 54', "From Jo's day column: mechanic pre-filled, no customer yet, 'The bike is here now' on"),
  // The job — one page, no tabs (the 7 stages are its situation list)
  'job-overview': keep(15, { sizes: ['desktop', 'tablet', 'phone'] }), // rule 3: own touch layout (Workshop day 3)
  'job-book-in': into('job-overview', 'Workshop day 20', "'Booked in'; 'Bike tag sent' strip with barcode; 'Send quote' and 'Start work'"),
  'job-quote': into('job-overview', 'Workshop day 20', "'Quoting'; new lines pending, 'Proposed' total; 'Send quote'"),
  'job-mechanic': into('job-overview', 'Workshop day 20', "Alex Morgan's view: checklist progress, approved lines; 'Mark ready for collection'"),
  'job-waiting-parts': into('job-overview', 'Workshop day 20', "'Waiting for parts' strip: 'Replacement rear brake pads delayed', 'Moved to Sat 19 Sep · 16:00'"),
  'job-finished': into('job-overview', 'Workshop day 20', "'Finished'; 'Alex marked it ready at 15:30' with 'Undo'; 'Take payment'"),
  'job-collection': into('job-overview', 'Workshop day 20', "'Paid' strip, 'Paid online · [date]'; footer 'Hand over'"),
  'job-checklist': keep(7),
  // Customer account
  'customer': into('cs-page', 'Customer service 11', "One-shop business: history rows without the shop name (cs-page shows '· Bolton')"),
  // Overview page
  'overview': keep(3),
};

// Extra situation lines with no old drawing behind them ("Draw the decisions"
// spec, section 8: D3, D4, D5).
export const lines = [
  // D3 — the diary
  { on: 'diary', text: 'A workshop computer: the Working: Alex Morgan · Switch bar, and everything done is recorded under that name and role', who: 'Mechanic', decision: 'Walk-through 8, decisions 1 and 4' },
  { on: 'diary', text: 'A change on another device shows here within a few seconds', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'diary', text: "A shared-queue job: I'll do this puts it in your column at your next free time; every device shows Taken by Jo Taylor", who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 5' },
  { on: 'diary', text: 'Me is the person working now; anyone with Works in the workshop gets Me', who: 'Staff and Mechanic', decision: 'Walk-through 8, fix M2' },
  { on: 'diary', text: 'A workshop computer with nobody working: opens on Everyone', who: 'Staff and Mechanic', decision: 'Walk-through 8, fix M2' },
  // D4 — the job
  { on: 'job-overview', text: "A workshop computer: Working: Alex Morgan · Switch in the job's header", who: 'Mechanic', decision: 'Walk-through 8, decision 4' },
  { on: 'job-overview', text: 'Open on another device: Jo Taylor has this job open', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'job-overview', text: "Notes: the other person's words arrive as they type", who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'job-overview', text: "Two people change one line: Keep mine or Keep Alex's", who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 2' },
  { on: 'job-overview', text: "On a desktop, Add photo: Choose a file or Use my phone (a code to scan opens that line's photo step, no sign-in)", who: 'Mechanic', decision: 'Walk-through 8, decision 6' },
  { on: 'job-overview', text: 'Who did what, folded: name, what, time; Mark ready records Signed off by Alex Morgan · 15:30', who: 'Staff and Mechanic', decision: 'Walk-through 8, decision 7; build plan Q3' },
  // D5 — the quick look
  { on: 'job-quick-overview', text: 'After Mark ready: Signed off by Alex Morgan · 15:30 in the hover summary', who: 'Staff and Mechanic', decision: 'Build plan Q3' },
  // "Draw the answers" spec, section 11: D3, D4, D5
  { on: 'job-overview', text: 'A part added with no free stock (stock less holds): it goes on the For customers restock list by itself, and the line reads On order once that part is on an order marked ordered', who: 'Mechanic', decision: 'Receiving stock, 3 Oct (walk-through 3 M7)' },
  { on: 'job-overview', text: 'At a Lightspeed shop: the Lightspeed strip under the header, Hand over in place of Take payment, and the header tag reads Agreed', who: 'Staff', decision: 'Lightspeed shops 10; walk-through 6 L5' },
  { on: 'new-job', text: 'Saved: Booking confirmed sent to 07700 900 142, or No message — no phone or email', who: 'Staff', decision: 'Book a repair 12; 3 Oct (walk-through 9 L4)' },
  { on: 'diary', text: "Maya's own request, WH-1042, with no deposit, in Waiting for you", who: 'Staff', decision: 'Walk-through 1 L6' },
  // The second walk's smaller questions, 3 Oct (answer 9).
  { on: 'job-overview', text: 'Waiting for a part on a transfer that was cancelled: Banner: Transfer T-[0000] was cancelled on [date] before the Shimano brake pads B05S-RX came · reorder them, or tell Maya', who: 'Staff and Mechanic', decision: 'Stock control 11; UX walk-through decision 6 (walk-through 3, rs-part-order-closed); 3 Oct (second walk Q9)' },
  { on: 'job-overview', text: 'Mark ready for collection with the quote still unanswered: it waits until the quote is answered, recorded from a phone call, or withdrawn', who: 'Staff and Mechanic', decision: 'Quote 4; 3 Oct (second walk, case 1a)' },
  { on: 'job-overview', text: 'Collecting at the other shop: a bike is collected and paid for only at the shop that did the work', who: 'Staff', decision: 'Multiple sites 2; 3 Oct (second walk, case 9c)' },
];
