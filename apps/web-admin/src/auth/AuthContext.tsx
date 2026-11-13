import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { subscribeLogout } from "../api/client";
import { logoutSession } from "../api/endpoints";
import { tokenStore } from "../api/tokenStore";
import { isDemo } from "../api/demo";
import type { User } from "../api/types";
import { Sentry } from "../sentry";

// Dev demo mode: a signed-in "owner" so the protected pages render without a
// backend. id matches the roster owner in demo.ts so their row shows "You".
const DEMO_USER: User = {
  id: "demo-owner",
  email: "alex@home.app",
  display_name: "Alex Tran",
  account_type: "parent",
};

interface AuthState {
  user: User | null;
  isAuthed: boolean;
  setSession: (user: User) => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(
    () => (isDemo() ? tokenStore.getUser() ?? DEMO_USER : tokenStore.getUser()),
  );
  const [isAuthed, setIsAuthed] = useState<boolean>(() => isDemo() || tokenStore.isAuthed());

  useEffect(() => {
    // The API client emits a logout when a refresh fails.
    return subscribeLogout(() => {
      setUser(null);
      setIsAuthed(false);
    });
  }, []);

  // Attach (or clear) the signed-in user on every Sentry event. Covers login,
  // logout, refresh-failure, and a session restored from storage on load.
  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email, username: user.username });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  const value: AuthState = {
    user,
    isAuthed,
    setSession: (u) => {
      tokenStore.setUser(u);
      setUser(u);
      setIsAuthed(true);
    },
    logout: () => {
      // Revoke server-side first (it reads the refresh token), but don't wait:
      // the UI signs out immediately either way.
      void logoutSession();
      tokenStore.clear();
      setUser(null);
      setIsAuthed(false);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
