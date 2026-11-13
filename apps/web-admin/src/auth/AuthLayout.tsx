import type { ReactNode } from "react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { KairoLockup } from "../components/Brand";

/**
 * AuthLayout — the shared "welcome surface": centered card on a soft accent
 * gradient with the Kairo lockup above it. The one place gradients are allowed
 * (see docs/07-ui-design.md); dashboards stay flat. The lockup's
 * wordmark is live text, so it follows the theme on its own.
 */
export function AuthLayout({
  children,
  wide,
  bare,
  hideLockup,
  footer,
}: {
  children: ReactNode;
  wide?: boolean;
  /** Skip the centered card wrapper — used by the two-column rail layout. */
  bare?: boolean;
  /** Hide the brand lockup above the card (sign-in supplies its own inline mark). */
  hideLockup?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-wrap welcome">
      <div className="auth-lang">
        <LanguageSwitcher />
      </div>
      {!hideLockup && (
        <div className="auth-logo">
          <KairoLockup size={40} />
        </div>
      )}
      {bare ? children : <div className={wide ? "auth-card wide" : "auth-card"}>{children}</div>}
      {footer && <div className="auth-foot">{footer}</div>}
    </div>
  );
}
