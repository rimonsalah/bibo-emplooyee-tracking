# 147 — web-admin: localize Administrators / Login history + review polish

- **Type:** Implementation
- **Status:** Done (QA pending — native review of new strings like ticket 110)
- **Follows:** review in 143–146

## Changes
- **i18n:** Administrators and Login history pages (and their nav labels) were
  English-only. All strings now live in `settings.json` (`admins.*`,
  `loginHistory.*`) and `common.json` (`nav.administrators|loginHistory`) for all
  7 locales. Login dates use `activeLocale()`. The member role shows the persona
  term (Employee / Kid) instead of a hardcoded "Employee".
- **Administrators:** native `confirm()` replaced with a `Modal` that says the
  account itself is not deleted; create form moved into a `bibo-dlg` modal using
  the design-system fields; `.ad-badge` (used but never defined) now styled.
- **Stale responses:** Administrators, Login history and the member-detail roster
  lookup ignore responses that arrive after the business/member changed.
- **Business load failure:** was silently shown as "no businesses yet". AppShell
  now shows a localized error with Retry; Dashboard hides the empty state on error.
- **Member not found:** member detail shows a notice when the id isn't in the
  selected business's roster (instead of a generic "Employee" header).
- **Login history device:** recognizes the desktop app via its new User-Agent
  (`BiBoTracking-Desktop/<ver> (<os>)`, see desktop `sync/client.rs`) and labels
  browsers with their OS. Old desktop logins (no UA) still show "Unknown device".
- **Dedupe:** `StatCard`, `memberStatus`, `initials`, the `svg` helper and shared
  icons moved to `components/member.tsx` (Dashboard + EmployeeDetail).

## Verify
- web-admin `tsc --noEmit` + `vite build` — pass.
- Desktop `cargo check` — **not run** (no Rust toolchain on the machine used).
  Change is two `.user_agent(user_agent())` builder calls + a `format!` helper.
