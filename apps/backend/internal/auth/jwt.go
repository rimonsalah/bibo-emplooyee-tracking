package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Token kinds. Access tokens authorize API calls; refresh tokens mint new access
// tokens. Each token carries its kind so one can't be used in place of the other.
const (
	kindAccess  = "access"
	kindRefresh = "refresh"
)

const (
	accessTTL  = 15 * time.Minute
	refreshTTL = 30 * 24 * time.Hour
)

// ErrInvalidToken is returned for any malformed, expired, or wrong-kind token.
var ErrInvalidToken = errors.New("invalid token")

// Manager issues and verifies JWTs with a shared secret.
type Manager struct {
	secret []byte
}

// NewManager builds a token manager from the configured signing secret.
func NewManager(secret string) *Manager {
	return &Manager{secret: []byte(secret)}
}

type claims struct {
	Kind string `json:"kind"`
	// Session id: minted at login and carried unchanged through every refresh,
	// so logout can revoke the whole chain. Empty on tokens issued before it existed.
	Sid string `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// TokenPair is what login/refresh return to the client.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // access token lifetime, seconds
}

// Issue mints a fresh access + refresh pair for the given user id, starting a
// new session (login/register).
func (m *Manager) Issue(userID string) (TokenPair, error) {
	return m.IssueForSession(userID, uuid.NewString())
}

// IssueForSession mints a pair that continues an existing session (refresh).
// An empty sid (legacy token) starts a new one.
func (m *Manager) IssueForSession(userID, sid string) (TokenPair, error) {
	if sid == "" {
		sid = uuid.NewString()
	}
	access, err := m.sign(userID, sid, kindAccess, accessTTL)
	if err != nil {
		return TokenPair{}, err
	}
	refresh, err := m.sign(userID, sid, kindRefresh, refreshTTL)
	if err != nil {
		return TokenPair{}, err
	}
	return TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int(accessTTL.Seconds()),
	}, nil
}

func (m *Manager) sign(userID, sid, kind string, ttl time.Duration) (string, error) {
	now := time.Now()
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Kind: kind,
		Sid:  sid,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	})
	return t.SignedString(m.secret)
}

// ParseAccess validates an access token and returns its user id.
func (m *Manager) ParseAccess(token string) (string, error) {
	return m.parse(token, kindAccess)
}

// ParseRefresh validates a refresh token and returns its user id.
func (m *Manager) ParseRefresh(token string) (string, error) {
	return m.parse(token, kindRefresh)
}

// RefreshInfo is what refresh/logout need from a valid refresh token.
type RefreshInfo struct {
	UserID    string
	Sid       string // empty for tokens issued before sessions existed
	ExpiresAt time.Time
}

// ParseRefreshInfo validates a refresh token and returns its session and expiry.
func (m *Manager) ParseRefreshInfo(token string) (RefreshInfo, error) {
	c, err := m.parseClaims(token, kindRefresh)
	if err != nil {
		return RefreshInfo{}, err
	}
	info := RefreshInfo{UserID: c.Subject, Sid: c.Sid}
	if c.ExpiresAt != nil {
		info.ExpiresAt = c.ExpiresAt.Time
	}
	return info, nil
}

func (m *Manager) parse(token, wantKind string) (string, error) {
	c, err := m.parseClaims(token, wantKind)
	if err != nil {
		return "", err
	}
	return c.Subject, nil
}

func (m *Manager) parseClaims(token, wantKind string) (*claims, error) {
	c := &claims{}
	parsed, err := jwt.ParseWithClaims(token, c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !parsed.Valid || c.Kind != wantKind || c.Subject == "" {
		return nil, ErrInvalidToken
	}
	return c, nil
}
