package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"ctracking/backend/internal/privacyapps"

	"github.com/jackc/pgx/v5"
)

// ErrForbidden is returned when a user acts on a business they don't own.
var ErrForbidden = errors.New("forbidden")

// Business is a company/team owned by a user.
type Business struct {
	ID                      string   `json:"id"`
	Name                    string   `json:"name"`
	Kind                    string   `json:"kind"` // 'team' | 'family'
	OwnerUserID             string   `json:"owner_user_id"`
	ScreenshotRetentionDays *int     `json:"screenshot_retention_days"`
	ScreenshotIntervalS     int      `json:"screenshot_interval_s"`
	IdleThresholdS          int      `json:"idle_threshold_s"`
	AllowEmployeeOverride   bool     `json:"allow_employee_override"`
	ScreenshotMode          string   `json:"screenshot_mode"` // 'privacy' | 'normal'
	ScreenshotSkipApps      []string `json:"screenshot_skip_apps"`
}

// businessCols is the column list backing a Business scan (see scanBusiness).
const businessCols = "id, name, kind, owner_user_id, screenshot_retention_days, screenshot_interval_s, idle_threshold_s, allow_employee_override, screenshot_mode, screenshot_skip_apps"

// Employee is a member with the employee role within a business.
type Employee struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

// CreateBusiness creates a business and the owner membership in one transaction.
// kind is 'team' | 'family'; pass "" to default to 'team'.
func (s *Store) CreateBusiness(ctx context.Context, ownerID, name, kind string) (Business, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Business{}, err
	}
	defer tx.Rollback(ctx)

	biz, err := createBusinessTx(ctx, tx, ownerID, name, kind)
	if err != nil {
		return Business{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Business{}, err
	}
	return biz, nil
}

// scanner is satisfied by pgx.Row and pgx.Rows.
type scanner interface {
	Scan(dest ...any) error
}

func scanBusiness(s scanner) (Business, error) {
	var b Business
	err := s.Scan(&b.ID, &b.Name, &b.Kind, &b.OwnerUserID, &b.ScreenshotRetentionDays,
		&b.ScreenshotIntervalS, &b.IdleThresholdS, &b.AllowEmployeeOverride,
		&b.ScreenshotMode, &b.ScreenshotSkipApps)
	return b, err
}

// ListBusinessesOwnedBy returns businesses the user can administer. The primary
// owner and invited administrators both have an `owner` membership.
func (s *Store) ListBusinessesOwnedBy(ctx context.Context, ownerID string) ([]Business, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+businessCols+`
		   FROM businesses b
		  WHERE EXISTS (SELECT 1 FROM memberships m
		                 WHERE m.business_id = b.id AND m.user_id = $1 AND m.role = 'owner')
		  ORDER BY b.created_at`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Business{}
	for rows.Next() {
		b, err := scanBusiness(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// GetBusiness returns a business by id.
func (s *Store) GetBusiness(ctx context.Context, id string) (Business, error) {
	return getBusiness(ctx, s.pool, id)
}

// CreateEmployee creates an employee account + employee membership. If businessID is
// nil, the employee is placed in the owner's first business, auto-creating a default
// business ("<owner>'s Team") when the owner has none. If businessID is set, the
// caller must own that business. All in one transaction.
func (s *Store) CreateEmployee(ctx context.Context, ownerID string, businessID *string, email, username, passwordHash, displayName string) (Employee, Business, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Employee{}, Business{}, err
	}
	defer tx.Rollback(ctx)

	var biz Business
	if businessID != nil {
		biz, err = getBusiness(ctx, tx, *businessID)
		if err != nil {
			return Employee{}, Business{}, err
		}
		var allowed bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND business_id = $2 AND role = 'owner')`, ownerID, biz.ID).Scan(&allowed); err != nil {
			return Employee{}, Business{}, err
		}
		if !allowed {
			return Employee{}, Business{}, ErrForbidden
		}
	} else {
		biz, err = firstAdminBusinessTx(ctx, tx, ownerID)
		if errors.Is(err, ErrNotFound) {
			// Skip-business flow: auto-create a default business for this owner.
			// A parent owner gets a 'family' business labelled "...'s Family".
			var ownerName, accountType string
			if err := tx.QueryRow(ctx, `SELECT display_name, account_type FROM users WHERE id = $1`, ownerID).
				Scan(&ownerName, &accountType); err != nil {
				return Employee{}, Business{}, err
			}
			kind, suffix := "team", "'s Team"
			if accountType == "parent" {
				kind, suffix = "family", "'s Family"
			}
			biz, err = createBusinessTx(ctx, tx, ownerID, ownerName+suffix, kind)
		}
		if err != nil {
			return Employee{}, Business{}, err
		}
	}

	// Store NULL (not "") for a missing identifier so unique constraints don't
	// collide across members and the CHECK constraint reads cleanly.
	emailArg := nullableLower(email)
	usernameArg := nullableLower(username)
	var emp Employee
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, username, password_hash, display_name)
		 VALUES ($1, $2, $3, $4) RETURNING id, COALESCE(email, ''), COALESCE(username, ''), display_name`,
		emailArg, usernameArg, passwordHash, displayName,
	).Scan(&emp.ID, &emp.Email, &emp.Username, &emp.DisplayName)
	if isUniqueViolation(err) {
		return Employee{}, Business{}, ErrConflict
	}
	if err != nil {
		return Employee{}, Business{}, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO memberships (user_id, business_id, role) VALUES ($1, $2, 'employee')`,
		emp.ID, biz.ID,
	); err != nil {
		return Employee{}, Business{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Employee{}, Business{}, err
	}
	return emp, biz, nil
}

// ListEmployees returns the employee members of a business.
func (s *Store) ListEmployees(ctx context.Context, businessID string) ([]Employee, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT u.id, COALESCE(u.email, ''), COALESCE(u.username, ''), u.display_name
		   FROM memberships m
		   JOIN users u ON u.id = m.user_id
		  WHERE m.business_id = $1 AND m.role = 'employee'
		  ORDER BY u.display_name`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Employee{}
	for rows.Next() {
		var e Employee
		if err := rows.Scan(&e.ID, &e.Email, &e.Username, &e.DisplayName); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Administrator is a user who can manage and report on a business. Primary is
// true only for the immutable business owner; invited administrators can be removed.
type Administrator struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Primary     bool   `json:"primary"`
}

func (s *Store) ListAdministrators(ctx context.Context, businessID string) ([]Administrator, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.id, COALESCE(u.email, ''), COALESCE(u.username, ''), u.display_name,
		       u.id = b.owner_user_id AS primary
		  FROM memberships m
		  JOIN users u ON u.id = m.user_id
		  JOIN businesses b ON b.id = m.business_id
		 WHERE m.business_id = $1 AND m.role = 'owner'
		 ORDER BY primary DESC, u.display_name`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Administrator{}
	for rows.Next() {
		var a Administrator
		if err := rows.Scan(&a.ID, &a.Email, &a.Username, &a.DisplayName, &a.Primary); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// CreateAdministrator creates a separate login and grants administrator access.
// Only the primary owner may invite administrators.
func (s *Store) CreateAdministrator(ctx context.Context, primaryOwnerID, businessID, email, username, passwordHash, displayName string) (Administrator, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Administrator{}, err
	}
	defer tx.Rollback(ctx)
	var primary bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM businesses WHERE id = $1 AND owner_user_id = $2)`, businessID, primaryOwnerID).Scan(&primary); err != nil {
		return Administrator{}, err
	}
	if !primary {
		return Administrator{}, ErrForbidden
	}
	var a Administrator
	err = tx.QueryRow(ctx, `INSERT INTO users (email, username, password_hash, display_name)
		VALUES ($1, $2, $3, $4)
		RETURNING id, COALESCE(email, ''), COALESCE(username, ''), display_name`, nullableLower(email), nullableLower(username), passwordHash, displayName).
		Scan(&a.ID, &a.Email, &a.Username, &a.DisplayName)
	if isUniqueViolation(err) {
		return Administrator{}, ErrConflict
	}
	if err != nil {
		return Administrator{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO memberships (user_id, business_id, role) VALUES ($1, $2, 'owner')`, a.ID, businessID); err != nil {
		return Administrator{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Administrator{}, err
	}
	return a, nil
}

func (s *Store) RemoveAdministrator(ctx context.Context, primaryOwnerID, businessID, adminID string) error {
	var primary, targetPrimary bool
	err := s.pool.QueryRow(ctx, `SELECT b.owner_user_id = $2, b.owner_user_id = $3 FROM businesses b WHERE b.id = $1`, businessID, primaryOwnerID, adminID).Scan(&primary, &targetPrimary)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if !primary || targetPrimary {
		return ErrForbidden
	}
	ct, err := s.pool.Exec(ctx, `DELETE FROM memberships WHERE business_id = $1 AND user_id = $2 AND role = 'owner'`, businessID, adminID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// settableColumns whitelists the business columns owners may PATCH, guarding the
// dynamic UPDATE against arbitrary column names.
var settableColumns = map[string]bool{
	"screenshot_retention_days": true,
	"screenshot_interval_s":     true,
	"idle_threshold_s":          true,
	"allow_employee_override":   true,
	"screenshot_mode":           true,
	"screenshot_skip_apps":      true,
}

// UpdateBusinessSettings updates only the provided columns (keys must be in
// settableColumns; values are already typed by the caller). A nil value sets NULL
// (used for "keep screenshots forever").
func (s *Store) UpdateBusinessSettings(ctx context.Context, businessID string, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}
	sets := make([]string, 0, len(fields))
	args := []any{businessID}
	for col, val := range fields {
		if !settableColumns[col] {
			return fmt.Errorf("not a settable column: %s", col)
		}
		args = append(args, val)
		sets = append(sets, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	q := fmt.Sprintf("UPDATE businesses SET %s WHERE id = $1", strings.Join(sets, ", "))
	ct, err := s.pool.Exec(ctx, q, args...)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// CapturePolicy is the org-controlled capture configuration the desktop applies.
type CapturePolicy struct {
	ScreenshotIntervalS     int      `json:"screenshot_interval_s"`
	IdleThresholdS          int      `json:"idle_threshold_s"`
	ScreenshotRetentionDays *int     `json:"screenshot_retention_days"`
	AllowEmployeeOverride   bool     `json:"allow_employee_override"`
	Kind                    string   `json:"kind"` // 'team' | 'family' — drives onboarding copy
	ScreenshotMode          string   `json:"screenshot_mode"`
	ScreenshotSkipApps      []string `json:"screenshot_skip_apps"`
}

// PolicyForUser returns the capture policy for the user's business, or nil when the
// user belongs to no business (a standalone user → the desktop keeps local defaults).
func (s *Store) PolicyForUser(ctx context.Context, userID string) (*CapturePolicy, error) {
	bizID, err := s.ResolveBusinessForUser(ctx, userID, nil)
	if errors.Is(err, ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var p CapturePolicy
	err = s.pool.QueryRow(ctx,
		`SELECT screenshot_interval_s, idle_threshold_s, screenshot_retention_days, allow_employee_override, kind, screenshot_mode, screenshot_skip_apps
		   FROM businesses WHERE id = $1`, bizID,
	).Scan(&p.ScreenshotIntervalS, &p.IdleThresholdS, &p.ScreenshotRetentionDays, &p.AllowEmployeeOverride, &p.Kind, &p.ScreenshotMode, &p.ScreenshotSkipApps)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// --- transaction-scoped helpers (work with both *pgxpool.Pool and pgx.Tx) ---

// rowQuerier is satisfied by *pgxpool.Pool and pgx.Tx.
type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func getBusiness(ctx context.Context, q rowQuerier, id string) (Business, error) {
	b, err := scanBusiness(q.QueryRow(ctx, `SELECT `+businessCols+` FROM businesses WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Business{}, ErrNotFound
	}
	if err != nil {
		return Business{}, err
	}
	return b, nil
}

func firstAdminBusinessTx(ctx context.Context, tx pgx.Tx, ownerID string) (Business, error) {
	b, err := scanBusiness(tx.QueryRow(ctx,
		`SELECT `+businessCols+` FROM businesses b
		  WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.business_id = b.id AND m.user_id = $1 AND m.role = 'owner')
		  ORDER BY b.created_at LIMIT 1`, ownerID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Business{}, ErrNotFound
	}
	if err != nil {
		return Business{}, err
	}
	return b, nil
}

func createBusinessTx(ctx context.Context, tx pgx.Tx, ownerID, name, kind string) (Business, error) {
	if kind == "" {
		kind = "team"
	}
	// New businesses start in privacy mode with the skip-list prefilled from the
	// curated sensitive-app rules; owners can add/remove entries afterwards.
	b, err := scanBusiness(tx.QueryRow(ctx,
		`INSERT INTO businesses (name, owner_user_id, kind, screenshot_skip_apps) VALUES ($1, $2, $3, $4) RETURNING `+businessCols,
		name, ownerID, kind, privacyapps.Flat()))
	if err != nil {
		return Business{}, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO memberships (user_id, business_id, role) VALUES ($1, $2, 'owner')`,
		ownerID, b.ID,
	); err != nil {
		return Business{}, err
	}
	return b, nil
}
