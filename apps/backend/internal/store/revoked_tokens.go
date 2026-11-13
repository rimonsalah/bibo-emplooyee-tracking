package store

import (
	"context"
	"time"
)

// RevokeSession denylists a login session (all its refresh tokens) until they expire.
// Idempotent. Also prunes rows whose tokens have expired (they can't be used anyway).
func (s *Store) RevokeSession(ctx context.Context, sessionID string, expiresAt time.Time) error {
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO revoked_refresh_tokens (session_id, expires_at) VALUES ($1, $2)
		 ON CONFLICT (session_id) DO NOTHING`, sessionID, expiresAt); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM revoked_refresh_tokens WHERE expires_at < now()`)
	return err
}

// IsSessionRevoked reports whether a login session was signed out.
func (s *Store) IsSessionRevoked(ctx context.Context, sessionID string) (bool, error) {
	var revoked bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM revoked_refresh_tokens WHERE session_id = $1)`, sessionID).Scan(&revoked)
	return revoked, err
}
