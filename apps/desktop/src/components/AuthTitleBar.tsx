import { dragWindow } from "./dragWindow";
import { BRAND } from "../Brand";

/**
 * AuthTitleBar — the custom (Overlay) window title bar for the auth / onboarding
 * surfaces: a draggable strip with the app name centered. The native macOS
 * traffic lights overlay the left. No tray/tracking icon here — tracking is
 * paused until setup completes, so there's no state to show. "Kairo"
 * is the brand and stays verbatim in every locale.
 */
export function AuthTitleBar() {
  return (
    <div className="welcome-titlebar" onMouseDown={dragWindow}>
      <span className="welcome-titlebar-title">{BRAND}</span>
    </div>
  );
}
