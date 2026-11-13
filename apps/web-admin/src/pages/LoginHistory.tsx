import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { listLoginEvents } from "../api/endpoints";
import { ApiError, type LoginEvent } from "../api/types";
import { Empty, Notice, Spinner } from "../components/ui";
import { useBusinesses } from "../useBusinesses";
import { memberTerms } from "../terms";
import { activeLocale } from "../i18n";

const OS_NAMES: Record<string, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };

// Best-effort device label from the User-Agent. The desktop app sends
// "BiBoTracking-Desktop/<version> (<os>)"; anything else is a browser.
// OS / product names are not translated.
function deviceLabel(userAgent: string, t: TFunction<"settings">): string {
  if (!userAgent) return t("loginHistory.device.unknown");
  const desktop = /BiBoTracking-Desktop\/([\w.\-]+)(?: \((\w+)\))?/.exec(userAgent);
  if (desktop) {
    const os = desktop[2] ? OS_NAMES[desktop[2]] ?? desktop[2] : null;
    return `${t("loginHistory.device.desktop")}${os ? ` · ${os}` : ""}`;
  }
  // Order matters: Android and iOS UAs also mention Linux / Mac OS X.
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad/i.test(userAgent)) return "iPhone/iPad";
  if (/windows/i.test(userAgent)) return `${t("loginHistory.device.browser")} · Windows`;
  if (/macintosh|mac os/i.test(userAgent)) return `${t("loginHistory.device.browser")} · macOS`;
  if (/linux/i.test(userAgent)) return `${t("loginHistory.device.browser")} · Linux`;
  return t("loginHistory.device.browser");
}

export function LoginHistory() {
  const { t } = useTranslation("settings");
  const { selected, selectedId, loading: businessLoading } = useBusinesses();
  const terms = memberTerms(selected?.kind);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEvents([]);
    setError("");
    if (!selectedId) return;
    // Drop a late response if the user switches business mid-request.
    let current = true;
    setLoading(true);
    listLoginEvents(selectedId)
      .then((result) => current && setEvents(result.login_events))
      .catch((err) => current && setError(err instanceof ApiError ? err.message : t("loginHistory.errorLoad")))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [selectedId, t]);

  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString(activeLocale(), { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="ad-wrap" style={{ paddingBottom: 32 }}>
      <div className="ad-pagehead">
        <div className="ad-pagehead__main">
          <h1 className="ad-h1">{t("loginHistory.title")}</h1>
          <p className="ad-sub">
            {t("loginHistory.subtitle", { name: selected?.name ?? t("admins.thisWorkspace") })}
          </p>
        </div>
      </div>

      <Notice kind="info">{t("loginHistory.locationNote")}</Notice>
      {error && <Notice kind="danger">{error}</Notice>}
      {(businessLoading || loading) && <Spinner label={t("loginHistory.loading")} />}
      {!businessLoading && !loading && !selected && <Empty>{t("admins.noWorkspace")}</Empty>}
      {!loading && !error && selected && events.length === 0 && <Empty>{t("loginHistory.empty")}</Empty>}
      {!loading && events.length > 0 && (
        <div className="bibo-card bibo-card--default ad-tablecard" style={{ marginTop: 18, overflowX: "auto" }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th>{t("loginHistory.table.user")}</th>
                <th>{t("loginHistory.table.role")}</th>
                <th>{t("loginHistory.table.time")}</th>
                <th>{t("loginHistory.table.ip")}</th>
                <th>{t("loginHistory.table.location")}</th>
                <th>{t("loginHistory.table.device")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.display_name}</strong>
                    <div className="ad-login">{event.email || event.username}</div>
                  </td>
                  <td>
                    <span className={`ad-badge${event.role === "owner" ? " ad-badge--primary" : ""}`}>
                      {event.role === "owner" ? t("loginHistory.roleAdmin") : terms.one}
                    </span>
                  </td>
                  <td className="num">{fmtWhen(event.created_at)}</td>
                  <td>
                    <code>{event.ip_address}</code>
                  </td>
                  <td>
                    {[event.city, event.country].filter(Boolean).join(", ") || t("loginHistory.locationUnknown")}
                  </td>
                  <td title={event.user_agent}>{deviceLabel(event.user_agent, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
