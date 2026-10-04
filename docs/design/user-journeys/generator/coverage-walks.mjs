// The coverage walks (WP-W.5, 4 Oct): the 12 empty cells of the coverage
// check, each walked on the clickable mockup in ../walk-4/. A second, named
// source of evidence for coverage.mjs beside mockup/stories.mjs: each file,
// the journey it walked and the person it walked it as. coverage.mjs fails if
// a listed file is missing.
export const WALK_DIR = 'docs/design/user-journeys/walk-4';
export const coverageWalks = [
  { file: 'coverage-1-maya-site-menu.md', journey: 'ja', person: 'Maya' },
  { file: 'coverage-2-alex-your-settings.md', journey: 'ja', person: 'Alex' },
  { file: 'coverage-3-owner-graphs-setting.md', journey: 'ja', person: 'Jack' },
  { file: 'coverage-4-jo-website-off.md', journey: 'j01', person: 'Jo' },
  { file: 'coverage-5-buy-online-owner.md', journey: 'j02', person: 'Jack' },
  { file: 'coverage-6-online-orders-saturday.md', journey: 'j02', person: 'Saturday' },
  { file: 'coverage-7-online-booking-owner.md', journey: 'j03', person: 'Jack' },
  { file: 'coverage-8-phone-answer-jo.md', journey: 'j04', person: 'Jo' },
  { file: 'coverage-9-saturday-email-receipt.md', journey: 'j05', person: 'Saturday' },
  { file: 'coverage-10-jo-answers-question.md', journey: 'j07', person: 'Jo' },
  { file: 'coverage-11-review-requests.md', journey: 'j07', person: 'Jack' },
  { file: 'coverage-12-privacy-delete.md', journey: 'j15', person: 'Jack' },
];
