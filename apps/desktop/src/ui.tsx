import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KairoLockup, KairoMark } from "./Brand";

/** BrandMark — the Kairo app icon, shown on the welcome surface above the heading. */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <KairoMark size={56} title="" />
    </span>
  );
}

/** BrandLogo — mark + live wordmark for the welcome surface (follows the theme). */
export function BrandLogo() {
  return (
    <div className="auth-logo">
      <KairoLockup size={40} />
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      {children}
    </div>
  );
}

const TrendUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
const TrendDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
    <path d="M7 7l10 10M17 9v8H9" />
  </svg>
);

export function StatCard({
  icon,
  label,
  value,
  focal,
  delta,
  deltaDir = "up",
  sub,
  chart,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  focal?: boolean;
  delta?: ReactNode;
  /** Trend direction: colours the delta and picks the arrow ("none" = no arrow, neutral). */
  deltaDir?: "up" | "down" | "none";
  sub?: ReactNode;
  chart?: ReactNode;
}) {
  return (
    <div className={`bibo-stat${focal ? " is-focal" : ""}`}>
      <div className="bibo-stat__top">
        {icon && <span className="bibo-stat__icon">{icon}</span>}
        <span className="bibo-stat__label">{label}</span>
      </div>
      <div className="bibo-stat__value num">{value}</div>
      {(delta || sub || chart) && (
        <div className="bibo-stat__foot">
          {delta && (
            <span className={`bibo-stat__delta bibo-stat__delta--${deltaDir}`}>
              {deltaDir === "up" && <TrendUpIcon />}
              {deltaDir === "down" && <TrendDownIcon />}
              {delta}
            </span>
          )}
          {sub && <span className="bibo-stat__sub">{sub}</span>}
          {chart && <span className="bibo-stat__chart">{chart}</span>}
        </div>
      )}
    </div>
  );
}

export function BarRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="row" style={{ marginBottom: 10 }}>
      <div style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="num muted" style={{ width: 64, textAlign: "right" }}>
        {value}
      </div>
    </div>
  );
}

export function Pill({ kind, children }: { kind: "success" | "danger"; children: ReactNode }) {
  return <span className={`pill pill-${kind}`}>{children}</span>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, margin: "24px 0 10px" }}>{children}</div>
  );
}

/** StepDots — wizard/onboarding progress, e.g. ●──●──○ (current of total). */
export function StepDots({ total, current }: { total: number; current: number }) {
  const { t } = useTranslation("media");
  return (
    <span className="step-dots" role="img" aria-label={t("ui.stepOf", { current, total })}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <span className="dot-bar" />}
          <span
            className={`dot-step ${i + 1 < current ? "done" : i + 1 === current ? "current" : ""}`}
          />
        </span>
      ))}
    </span>
  );
}

export interface RailStep {
  title: string;
  description: string;
}

/** ProgressRail — vertical step list for the two-column onboarding layout.
 *  `current` is 1-based; markers derive from it (done ✓ / current ring / upcoming). */
export function ProgressRail({ steps, current }: { steps: RailStep[]; current: number }) {
  return (
    <ol className="progress-rail">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "upcoming";
        return (
          <li key={s.title} className={`rail-step ${state}`}>
            <span className="rail-marker" aria-hidden>
              {state === "done" ? "✓" : n}
            </span>
            <span className="rail-text">
              <span className="rail-title">{s.title}</span>
              <span className="rail-desc">{s.description}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** SuccessBurst — light gamified completion: a checklist of done + next items. */
export function SuccessBurst({
  title,
  items,
}: {
  title: string;
  items: { label: string; done: boolean }[];
}) {
  return (
    <div className="success-burst">
      <div className="burst-mark" aria-hidden>
        ✦
      </div>
      <div className="burst-title">{title}</div>
      <ul>
        {items.map((it) => (
          <li key={it.label} className={it.done ? "done" : "todo"}>
            {it.done ? "✓" : "○"} {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  labels,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Optional display labels keyed by option value (for localization). */
  labels?: Record<string, string>;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o} className={o === value ? "active" : ""} onClick={() => onChange(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
