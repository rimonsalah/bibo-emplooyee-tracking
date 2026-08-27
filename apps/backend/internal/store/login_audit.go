package store

import (
	"context"
	"time"
)

// LoginEvent records a successful account login. Location is approximate and
// is populated only when the deployment proxy supplies geographic headers.
type LoginEvent struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	DisplayName string    `json:"display_name"`
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	Role        string    `json:"role"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
	Country     string    `json:"country"`
	City        string    `json:"city"`
	CreatedAt   time.Time `json:"created_at"`
}

// RecordLogin stores a successful login. A nil businessID is allowed for a
// standalone account that has not joined a workspace yet.
func (s *Store) RecordLogin(ctx context.Context, userID string, businessID *string, ipAddress, userAgent, country, city string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO login_events (user_id, business_id, role, ip_address, user_agent, country, city)
		VALUES ($1, $2, COALESCE((SELECT role FROM memberships WHERE user_id = $1 AND business_id = $2), 'member'), $3, $4, $5, $6)`,
		userID, businessID, ipAddress, userAgent, country, city)
	return err
}

// ListLoginEvents returns the latest successful logins for members of a
// workspace. Membership role is resolved at read time.
func (s *Store) ListLoginEvents(ctx context.Context, businessID string, limit int) ([]LoginEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := s.pool.Query(ctx, `
		SELECT le.id, u.id, u.display_name, COALESCE(u.email, ''), COALESCE(u.username, ''),
		       le.role, le.ip_address, le.user_agent, le.country, le.city, le.created_at
		  FROM login_events le
		  JOIN users u ON u.id = le.user_id
		 WHERE le.business_id = $1
		 ORDER BY le.created_at DESC
		 LIMIT $2`, businessID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []LoginEvent{}
	for rows.Next() {
		var event LoginEvent
		if err := rows.Scan(&event.ID, &event.UserID, &event.DisplayName, &event.Email,
			&event.Username, &event.Role, &event.IPAddress, &event.UserAgent,
			&event.Country, &event.City, &event.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, event)
	}
	return out, rows.Err()
}
