# 149 — Rebrand to Kairo (midnight + lime) + landing-page Download section

- **Type:** Implementation (brand/UI)
- **Status:** Done (QA pending; native review of new marketing strings)

## Decisions (owner)
Name **Kairo** (from *kairos*, "the right moment"); look **midnight + lime, dark-first**;
scope web admin, desktop, extension, marketing. Trademark/domain availability not checked.

## Brand
- Mark: clock ring open at the top-right, lime dot in the gap ("the moment"), lime minute
  hand pointing at it. Master `brand/kairo-mark.svg`; `brand/build-icons.cjs` makes the
  dev/staging ribbon icons and tray status icons (lime tracking / amber idle / red paused).
- Type: Space Grotesk for headings, numbers, wordmark (fontsource; self-hosted on marketing).
- Tokens: midnight `#0B1020` base, lime `#C6F432` fill with navy `--on-brand` text, olive
  `#4D7C0F` accent for text on light. Both apps default to dark (saved choice wins).

## Changes
- **Web admin:** token blocks rewritten, raw purples → tokens, Kairo layer (primary buttons,
  rail, focal card, focus/selection); `Brand.tsx` (mark + live wordmark) replaces the PNG
  lockups and inline logos; favicon, title, 7-locale name swap; demo owner renamed.
- **Desktop:** tokens + Kairo layer, lime active nav, welcome surface uses olive accent;
  marks/titles/tray strings; `productName` and window titles → Kairo; full icon set
  regenerated (`tauri icon`); export file → `kairo_export.json`; UA → `Kairo-Desktop/…`
  (web Login history accepts old and new UA).
- **Extension:** name, icons, dark-first popup, docs.
- **Marketing:** midnight restyle, new assets (mark, favicon, app icon, OG card, web
  screenshots from demo mode), name swap in 7 locales. Removed upstream-owned items: GA id
  `G-EKVNL0JY98`, founder booking link, Telegram, personal email, Chrome-store listing,
  canonical `bibotracker.com` (now `SITE_DOMAIN` placeholder `kairo.example.com`).
- **Download section** (`#download`, nav link): Windows + macOS installers and the extension
  for Chrome, Edge, Brave/Opera, Firefox. URLs from `SITE_DL_WIN|MAC|EXT` and optional store
  listings `SITE_EXT_CHROME|EDGE|FIREFOX`; without a store URL a card offers the .zip +
  "Load unpacked" steps (Firefox: "coming soon" — needs AMO signing). Windows SmartScreen
  notice now triggers on `[data-win-dl]` links.
- **Backend:** download counter also counts `Kairo-Windows*.exe` and `Kairo-extension*.zip`.
- **CI:** Windows installer renamed to `Kairo-Windows-x64-setup.exe`; new
  `extension-zip.yml` builds `Kairo-extension.zip`.

## Open items
- Desktop screenshots on the marketing page (`shot-activity|browser|screenshots|settings`,
  demo video) still show the old UI — need the real app to re-capture.
- Set `SITE_DOMAIN`, privacy-policy contact, and upload installers/zip to `<STATIC_DIR>/download/`.
- Upstream `README`/docs history still references BiBoTracking by design.

## Verify
web-admin + desktop `tsc --noEmit` + `vite build`; backend `go build`/`go test`; marketing
`node build.mjs` (no unresolved placeholders); visual check via headless screenshots
(admin dark/light/detail/login, landing hero/download/mobile).
