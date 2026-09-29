// Board titles for the Workshop day redesign (diary.mjs). Shared by
// build-diary.mjs (its own canvas) and build.mjs (journey 12 of the user
// journeys canvas) so both name the boards the same way.
// waiting-open/change-selected keep their file ids (so existing links still
// work) but read with fuller titles on the canvas — decision 14/19's
// one-click-highlights state. The job boards use the brief's exact titles
// (decision 20: one page, no tabs, per stage).
export const TITLE_OVERRIDE = {
  'waiting-open': 'Pending request selected',
  'change-selected': 'Change request selected',
  'diary-context-menu': 'Diary · right-click a job',
  'job-quick-overview': 'Diary · job overview (quick look)',
  'diary-day': 'Day view',
  'diary-settings': 'Diary settings',
  'settings-accessibility': 'Settings · Accessibility',
  'diary-stack-hover': 'Diary · stacked jobs fanned out on hover',
  'diary-stack-open': 'Diary · choose a job from a stack',
  'diary-hover-summary': 'Diary · hover a job for its summary',
  'new-job-day': 'New job (from the day view)',
  'job-overview': 'Job · expected',
  'job-book-in': 'Job · booked in, tag printed',
  'job-quote': 'Job · quote',
  'job-mechanic': 'Job · in the workshop (mechanic)',
  'job-waiting-parts': 'Job · waiting for parts',
  'job-finished': 'Job · finished',
  'job-collection': 'Job · collection',
  'job-checklist': 'Job · full service checklist',
  'idea-s2-before': 'S2 before · one-line customer strip',
  'idea-s2-after': 'S2 after · two-row customer strip',
  'idea-s3-before': 'S3 before · a note box under every checklist item',
  'idea-s3-after': 'S3 after · collapsed checklist rows',
  'idea-s4-before': 'S4 before · plain "N jobs" overlap summary',
  'idea-s4-after': 'S4 after · stacked-card overlap control',
  'idea-s4-open': 'S4 open · choosing a job from the stack',
};
export const TITLE = (id) => TITLE_OVERRIDE[id] || id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
// Decision 68: on tablet and phone, hover and right-click become press-and-
// hold, so those boards are titled for the touch gesture they show.
export const TOUCH_TITLE_OVERRIDE = {
  'diary-context-menu': 'Diary · press and hold a job',
  'diary-stack-hover': 'Diary · press and hold a stack to fan it out',
  'diary-stack-open': 'Diary · tap a stack to choose a job',
  'diary-hover-summary': 'Diary · keep holding a job for its summary',
  'new-job-pick': 'New job · tap a free time',
};
export const TITLE_FOR = (id, size) => (size !== 'desktop' && TOUCH_TITLE_OVERRIDE[id]) || TITLE(id);
