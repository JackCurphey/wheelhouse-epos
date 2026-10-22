# Tasks

## 1. Server (Jack)
- [x] 1.1 Tests first: Settings routes (list, add, template, edit, services move, remove, refusals, Owner only, another shop's invisible)
- [x] 1.2 Tests first: the job's checklist (from the booking's service, from the order's service, none, tick and note, copy on first change, kept after the settings change, frozen once finished)
- [x] 1.3 Migration 052 and `server/workshop/checklists.js`
- [x] 1.4 Routes, the route list and screen trace
- [x] 1.5 `POST /api/workshop-jobs` takes `serviceIds`
- [ ] 1.6 `/review`, `npm test`, pull request

## 2. Screens (Jack)
- [ ] 2.1 Settings › Workshop › Checklists, to `set-workshop-checklists`, `-empty` and `set-workshop-checklist-edit`
- [ ] 2.2 The job page's bar and the checklist pop-up, to `job-mechanic` and `job-checklist`
- [ ] 2.3 New job sends its service
- [ ] 2.4 Screen tests first, a browser spec, the real-browser check
- [ ] 2.5 Archive into `openspec/specs/settings` and `openspec/specs/workshop-jobs`
