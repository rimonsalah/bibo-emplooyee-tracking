// Shared display helpers for member/report pages (Dashboard, EmployeeDetail).
// Display-only — no data fetching or business logic here.
import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";

export type MemberStatus = "active" | "idle" | "offline";

/** Presence from last-seen: active < 5 min, idle < 30 min, else offline. */
export function memberStatus(lastSeen: number | null): MemberStatus {
  if (!lastSeen) return "offline";
  const ageS = Date.now() / 1000 - lastSeen;
  if (ageS < 5 * 60) return "active";
  if (ageS < 30 * 60) return "idle";
  return "offline";
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

// ── inline icons (no icon dependency in web-admin) ───────────────────
export const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
export const IconClock = svg(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const IconCamera = svg(<><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /><circle cx="12" cy="13" r="3" /></>);

const TrendUp = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
const TrendDown = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
    <path d="M7 7 17 17M17 9v8H9" />
  </svg>
);

/** A real period-over-period change, or null to hide the badge. Never pass a
 *  made-up value — no badge is better than a fake trend. */
export type Delta = { text: string; up: boolean } | null;

export function StatCard(props: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  focal?: boolean;
  delta?: Delta;
  sub?: string;
  /** Real trend series only — omit until the API provides one. */
  spark?: { data: number[]; color: string };
}) {
  const { icon, label, value, focal, delta, sub, spark } = props;
  return (
    <div className={`bibo-card ${focal ? "bibo-card--focal" : "bibo-card--default"} ad-cardpad`}>
      <div className={`bibo-stat${focal ? " bibo-stat--focal" : ""}`}>
        <div className="bibo-stat__top">
          <div className="bibo-stat__icon">{icon}</div>
          <div className="bibo-stat__label">{label}</div>
        </div>
        <div className="bibo-stat__value">{value}</div>
        <div className="bibo-stat__foot">
          {delta && (
            <span className={`bibo-stat__delta bibo-stat__delta--${delta.up ? "up" : "down"}`}>
              {delta.up ? TrendUp : TrendDown}
              {delta.text}
            </span>
          )}
          {sub && <span className="bibo-stat__sub">{sub}</span>}
          {spark && (
            <span style={{ marginLeft: "auto" }}>
              <Sparkline data={spark.data} color={spark.color} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
