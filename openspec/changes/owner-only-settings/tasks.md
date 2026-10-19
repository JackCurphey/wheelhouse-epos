# Tasks: Settings for the Owner only

## 1. Server (Mark's files; flagged for him)

- [x] 1.1 Tests first, watched failing: a staff login's PUT to workshop settings and shop details is refused with owner_only and changes nothing; the Owner's goes through; GETs stay open
- [x] 1.2 `ownerOnly` and the two routes

## 2. Screen

- [x] 2.1 Tests first, watched failing: a non-owner sees the not-part-of-your-role card and no settings; the Owner sees Settings
- [x] 2.2 The Settings page's check
- [x] 2.3 Browser: a staff login typing the Settings address sees the card

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
