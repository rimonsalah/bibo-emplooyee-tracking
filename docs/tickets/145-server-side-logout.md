# 145 — Server-side logout (session revocation)

- **Type:** Implementation (security)
- **Status:** Done (QA pending)

## Problem
Refresh tokens are stateless 30-day JWTs and there was no logout endpoint.
"Sign out" in web-admin only cleared `localStorage`, so a copied refresh token
kept minting access tokens for up to 30 days.

## Design
- Every login/register starts a **session**: a random `sid` claim in both JWTs.
  `/v1/auth/refresh` keeps the same `sid` (`Manager.IssueForSession`), so all tokens
  minted from one login share it.
- `POST /v1/auth/logout {refresh_token}` → adds the `sid` to
  `revoked_refresh_tokens` (migration `00012`) until the token's expiry, pruning
  expired rows. Always `204` for a well-formed body (invalid token = nothing to do).
- `/refresh` rejects a revoked `sid` with 401.
- Why a session id, not per-token revocation/rotation: refresh issues a new token
  each time, so revoking one token leaves its older siblings valid; rotation would
  race across browser tabs (and the desktop app). One `sid` per login revokes the
  whole chain without changing refresh behavior.

## Limits (accepted)
- Access tokens aren't checked against the denylist (no DB hit per request), so an
  already-issued access token works until it expires (≤ 15 min).
- Tokens issued before this change have no `sid` and can't be revoked; they expire
  naturally (≤ 30 days). Refresh upgrades them to a new session.
- Desktop app doesn't call `/logout` yet (not changed here).

## Web
`AuthContext.logout` calls `logoutSession()` (best effort, not awaited) before
clearing local tokens. Other open tabs get a 401 on their next refresh and drop to
the login page.

## Verify
- Backend `go build ./...`, `go vet ./...`, `go test ./...` — pass (new
  `TestSessionIDCarriedThroughRefresh`).
- web-admin `tsc --noEmit` + `vite build` — pass.
- QA: sign in → copy refresh token from localStorage → Sign out →
  `POST /v1/auth/refresh` with the copied token returns 401.
