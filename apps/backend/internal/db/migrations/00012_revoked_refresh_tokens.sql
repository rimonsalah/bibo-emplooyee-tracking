-- +goose Up
-- Denylist of signed-out refresh tokens (by session id, the JWT "sid" claim). Refresh tokens stay
-- stateless JWTs; /v1/auth/logout adds the session id here and /refresh
-- rejects it. Rows are only needed until the token would have expired anyway.
CREATE TABLE revoked_refresh_tokens (
    session_id text PRIMARY KEY,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_revoked_refresh_tokens_expires
    ON revoked_refresh_tokens(expires_at);

-- +goose Down
DROP TABLE IF EXISTS revoked_refresh_tokens;
