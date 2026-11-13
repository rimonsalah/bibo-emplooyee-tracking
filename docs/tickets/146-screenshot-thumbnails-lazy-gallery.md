# 146 — Screenshot thumbnails + lazy gallery

- **Type:** Implementation (performance)
- **Status:** Done (QA pending)
- **Follows:** 143

## Problem
The member gallery fetched every screenshot at **full size** as soon as the tab
rendered (60 per page → often 10+ MB), even for cards far below the fold.

## Changes
- **Backend:** `GET /v1/screenshots/:client_uuid?size=thumb` returns a 480px-wide
  JPEG (q75), generated on first request and cached next to the original as
  `<uuid>.thumb.jpg` (atomic write). Falls back to the original if the image can't
  be decoded. Decoding uses `golang.org/x/image` (WebP; PNG/JPEG via stdlib).
- Thumbnails are deleted with the original (`filestore.Remove`, used by retention
  cleanup) and invalidated when a screenshot is re-uploaded (`Write`).
- `filestore.Remove` now confines paths to the storage root like `Open` already did.
- Image responses send `Cache-Control: private, max-age=86400` (screenshots are
  immutable), so reopening a day doesn't re-download them.
- **Web:** gallery cards fetch the thumbnail only when within 300px of the viewport
  (IntersectionObserver); the lightbox still loads full size. Cards are keyboard
  operable (Tab + Enter/Space, focus ring, `screenshots.open` label in 7 locales)
  and open even if the thumbnail failed.

## Not done (by design)
Per-tab lazy loading of report JSON: the summary cards need activity, keystrokes
and the screenshot count anyway, and the image bytes were the real cost.

## Verify
- Backend `go build`, `go vet`, `go test ./...` — pass (new
  `filestore/TestOpenThumbScalesCachesAndRemoves`, `TestRemoveRejectsEscape`).
- web-admin `tsc --noEmit` + `vite build` — pass.
- QA: open a day with many screenshots → network tab shows small `size=thumb`
  JPEGs loading as you scroll; clicking opens the full WebP.
