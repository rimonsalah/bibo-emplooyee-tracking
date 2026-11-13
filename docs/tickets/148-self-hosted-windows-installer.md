# 148 — Self-hosted Windows installer (CI build with your backend URL)

- **Type:** Implementation (build/infra)
- **Status:** Done (first CI run pending)

## Problem
The desktop app's server is compiled in (`production` → `https://bibotracker.com`).
A self-hosted deployment (e.g. on Coolify) needs installers that talk to its own
backend. Also, the updater polls `bibotracker.com/download/latest.json` and installs
**quietly**, trusting the upstream signing key — so a self-hosted install would
silently update itself into the upstream build and start syncing there.

## Changes
- `settings/mod.rs`: the production default reads `CTRACKING_DEFAULT_BACKEND_URL`
  at **compile time** (`option_env!`), falling back to the upstream URL. Upstream
  builds are unchanged. The runtime `CTRACKING_BACKEND_URL` override still wins.
- `.github/workflows/desktop-windows.yml` (manual `workflow_dispatch`, input
  `backend_url`): validates the URL, warns if `/healthz` isn't 200, runs the
  backend-URL test with the URL baked in, builds the NSIS installer with a config
  override that points the updater at `<url>/download/latest.json` and disables
  updater artifacts (no signing key needed), uploads the `.exe` as an artifact.

## Known limits
- Installer is **unsigned** → Windows SmartScreen "unknown publisher" prompt.
- No auto-updates for self-hosted installs until you publish a signed
  `latest.json` (needs your own updater key pair + `pubkey` override).
- The in-app "Get the extension" link still points to bibotracker.com/extension.
- macOS build not covered (needs Apple signing/notarization).

## Verify
- Workflow YAML parses. `cargo check`/build runs in CI (no Rust toolchain locally).
