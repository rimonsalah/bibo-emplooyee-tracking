-- +goose Up
-- Administrator access is represented by an `owner` membership. Existing
-- primary owners already have this row; invited administrators receive another.
CREATE INDEX IF NOT EXISTS idx_memberships_admin
    ON memberships(user_id, business_id)
    WHERE role = 'owner';

-- +goose Down
DROP INDEX IF EXISTS idx_memberships_admin;
