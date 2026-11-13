import { useId } from "react";

/** Product name. Kept out of the i18n catalogs on purpose: it's never translated. */
export const BRAND = "Kairo";

/**
 * Kairo mark — a clock whose ring opens at the top-right; the lime dot in the
 * gap is "the moment", the lime minute hand points at it. Master file:
 * brand/kairo-mark.svg (keep the two in sync).
 */
export function KairoMark({ size = 36, title = BRAND }: { size?: number; title?: string }) {
  // Unique gradient id: several marks can be on screen at once.
  const gid = `kairo-tile-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="kairo-mark"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#18213D" />
          <stop offset="1" stopColor="#0B1020" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <path d="M47.01 24.02A17 17 0 1 1 28.47 15.37" fill="none" stroke="#E8ECF5" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 32 38.8 35.17" fill="none" stroke="#E8ECF5" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 32 35.80 23.84" fill="none" stroke="#C6F432" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.6" fill="#C6F432" />
      <circle cx="39.18" cy="16.59" r="4.6" fill="#C6F432" />
    </svg>
  );
}

/** Mark + wordmark. The wordmark is live text (Space Grotesk), so it follows the theme. */
export function KairoLockup({ size = 40 }: { size?: number }) {
  return (
    <span className="kairo-lockup" style={{ ["--kairo-size" as string]: `${size}px` }}>
      <KairoMark size={size} title="" />
      <span className="kairo-wordmark">{BRAND}</span>
    </span>
  );
}
