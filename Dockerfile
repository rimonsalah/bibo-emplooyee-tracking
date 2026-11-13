# Kairo — all-in-one image (Coolify: Build Pack "Dockerfile", file "/Dockerfile").
# One container serves everything on one domain:
#   /            landing page (marketing/site, all 7 locales)
#   /admin       web admin SPA (same-origin API, no VITE_API_BASE needed)
#   /v1/...      API
#   /download/   installers + extension zip  → mount a volume at /app/static/download
# Screenshots live in /app/storage → mount a volume there too.

# --- 1. web: web admin + landing page ---
FROM node:22-alpine AS web
WORKDIR /src
RUN corepack enable
COPY . .
# Canonical URLs / sitemap of the landing page.
ARG SITE_DOMAIN=https://me.linkosolution.com
RUN pnpm install --frozen-lockfile --filter "@ctracking/web-admin..." \
 && pnpm --filter @ctracking/web-admin build \
 && SITE_BASE_URL="$SITE_DOMAIN" node marketing/build.mjs

# --- 2. api: Go backend ---
FROM golang:1.26-alpine AS api
WORKDIR /src
COPY apps/backend/go.mod apps/backend/go.sum ./
RUN go mod download
COPY apps/backend/ ./
RUN CGO_ENABLED=0 go build -ldflags "-X ctracking/backend/internal/handlers.Version=$(date +%Y%m%d)" -o /out/server ./cmd/server

# --- 3. runtime ---
FROM alpine:3.20
RUN adduser -D -u 10001 app
WORKDIR /app
COPY --from=api /out/server /app/server
COPY --from=web /src/marketing/site /app/static
COPY --from=web /src/apps/web-admin/dist /app/static/admin
RUN mkdir -p /app/storage/screenshots /app/static/download && chown -R app /app
USER app
ENV PORT=8080 \
    STATIC_DIR=/app/static \
    STORAGE_DIR=/app/storage
EXPOSE 8080
ENTRYPOINT ["/app/server"]
