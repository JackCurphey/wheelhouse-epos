# Tasks: two shops with the same name signing up at once

## 1. Tests first, each watched failing

- [x] 1.1 Three sign-ups with the same name at once, ten rounds: all succeed with the name, -2 and -3 (failed with `23505 duplicate key value violates unique constraint "shops_slug_key"` before the fix)

## 2. Build

- [x] 2.1 `createShop` saves the shop with `ON CONFLICT (slug) DO NOTHING` and tries the next number when nothing was saved, in place of looking first and saving after

## 3. Checks

- [x] 3.1 A fresh review (no problems in the code; three gaps in this change's paperwork, fixed)
- [x] 3.2 `npm test` and `npm run test:browser` pass
