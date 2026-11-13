# 143 — web-admin: report accuracy fixes

- **Type:** Implementation (bugfix)
- **Status:** Done (QA pending)

## Goal
Remove numbers in the owner dashboard that were not backed by data, and fix
counts that were wrong.

## Changes
1. **No fake trends on member detail.** The stat cards showed hardcoded badges
   (`12%`, `8%`, `+4`, always "up"). Removed; cards now show the period
   (single day / date range). The "Top app" card shows its real share + time
   instead of a "Focus" label. The top app is picked by max duration rather than
   assuming the API's breakdown order.
2. **"You" badge only for the signed-in user.** Since multi-administrator access,
   every admin has role `owner`, so Dashboard and member detail marked all of them
   "You". Now `id === user.id` only (Employees page already did this).
3. **Screenshots: true total + paging.** The gallery requested 60 and never paged,
   and the Screenshots card counted the loaded page (max 60).
   - Backend: `GET /v1/reports/employees/:id/screenshots` now also returns `total`
     (`store.ScreenshotsCount`, same scope as the report).
   - Web: card shows `total`; gallery shows "Showing X of Y" + "Load N more"
     (60 per page, de-duplicated). New `reports.screenshots.showing|loadMore` keys
     in all 7 locales. `total` is optional so an older backend still works.

## Verify
- web-admin `tsc --noEmit` + `vite build` — pass.
- Backend `go build ./...` + `go vet` + `go test ./...` — pass (verified in ticket 145 run).
- QA: a member with > 60 screenshots in a day → card shows full count, "Load more"
  appends the rest; a second administrator is not marked "You".
