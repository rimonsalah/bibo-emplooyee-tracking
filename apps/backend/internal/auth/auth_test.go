package auth

import "testing"

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("supersecret")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if hash == "supersecret" {
		t.Fatal("password stored in plaintext")
	}

	ok, err := VerifyPassword(hash, "supersecret")
	if err != nil || !ok {
		t.Fatalf("verify correct password: ok=%v err=%v", ok, err)
	}
	bad, err := VerifyPassword(hash, "wrong")
	if err != nil {
		t.Fatalf("verify wrong password errored: %v", err)
	}
	if bad {
		t.Fatal("wrong password verified")
	}
}

func TestPasswordSaltsDiffer(t *testing.T) {
	a, _ := HashPassword("same")
	b, _ := HashPassword("same")
	if a == b {
		t.Fatal("identical passwords produced identical hashes (salt not random)")
	}
}

func TestTokenKindEnforced(t *testing.T) {
	m := NewManager("test-secret")
	pair, err := m.Issue("user-123")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	uid, err := m.ParseAccess(pair.AccessToken)
	if err != nil || uid != "user-123" {
		t.Fatalf("parse access: uid=%q err=%v", uid, err)
	}
	if _, err := m.ParseRefresh(pair.AccessToken); err == nil {
		t.Fatal("access token accepted as refresh token")
	}
	if _, err := m.ParseAccess(pair.RefreshToken); err == nil {
		t.Fatal("refresh token accepted as access token")
	}
}

func TestSessionIDCarriedThroughRefresh(t *testing.T) {
	m := NewManager("test-secret")
	login, err := m.Issue("u1")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	first, err := m.ParseRefreshInfo(login.RefreshToken)
	if err != nil || first.Sid == "" || first.UserID != "u1" || first.ExpiresAt.IsZero() {
		t.Fatalf("parse refresh info: %+v err=%v", first, err)
	}

	refreshed, err := m.IssueForSession(first.UserID, first.Sid)
	if err != nil {
		t.Fatalf("issue for session: %v", err)
	}
	second, err := m.ParseRefreshInfo(refreshed.RefreshToken)
	if err != nil || second.Sid != first.Sid {
		t.Fatalf("refresh changed session: first=%q second=%q err=%v", first.Sid, second.Sid, err)
	}

	other, _ := m.Issue("u1")
	third, _ := m.ParseRefreshInfo(other.RefreshToken)
	if third.Sid == first.Sid {
		t.Fatal("a new login reused an existing session id")
	}
}

func TestTokenWrongSecretRejected(t *testing.T) {
	pair, _ := NewManager("secret-a").Issue("u1")
	if _, err := NewManager("secret-b").ParseAccess(pair.AccessToken); err == nil {
		t.Fatal("token signed with a different secret was accepted")
	}
}
