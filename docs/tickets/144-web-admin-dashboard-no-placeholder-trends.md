# 144 — web-admin Dashboard: remove placeholder sparklines, fix "Active today"

- **Type:** Implementation (bugfix)
- **Status:** Done (QA pending)
- **Follows:** 137 (dashboard redesign, which shipped placeholder trend lines), 143

## Problem
- Every stat card and roster row drew a sparkline from `seededSeries()`, a
  pseudo-random series seeded by a string. It looked like real trend data but wasn't.
- "Active today" counted members **seen in the last 30 minutes**, not members who
  recorded any activity today.

## Changes
- `StatCard.spark` is now optional and no card passes one. `seededSeries` is deleted.
  `Sparkline` stays for when the API returns real per-day series.
- Roster row: the fake mini-chart is replaced by a small dot in the focus color
  next to the real focus %.
- "Active today" = members with `active_today_s > 0`.

## Verify
- web-admin `tsc --noEmit` + `vite build` — pass.
