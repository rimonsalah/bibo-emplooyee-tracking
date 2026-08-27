-- +goose Up
CREATE TABLE login_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
    role        text NOT NULL DEFAULT 'member',
    ip_address  text NOT NULL,
    user_agent  text NOT NULL DEFAULT '',
    country     text NOT NULL DEFAULT '',
    city        text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_events_business_created
    ON login_events(business_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS login_events;
