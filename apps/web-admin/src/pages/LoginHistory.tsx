import { useEffect, useState } from "react";
import { listLoginEvents } from "../api/endpoints";
import { ApiError, type LoginEvent } from "../api/types";
import { Empty, Notice, Spinner } from "../components/ui";
import { useBusinesses } from "../useBusinesses";

function deviceLabel(userAgent: string) {
  if (!userAgent) return "Unknown device";
  if (/electron/i.test(userAgent)) return "Desktop app";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad/i.test(userAgent)) return "iPhone/iPad";
  return "Web browser";
}

export function LoginHistory() {
  const { selected, selectedId, loading: businessLoading } = useBusinesses();
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    void listLoginEvents(selectedId)
      .then(result => setEvents(result.login_events))
      .catch(err => setError(err instanceof ApiError ? err.message : "Could not load login history."))
      .finally(() => setLoading(false));
  }, [selectedId]);

  return <div className="ad-wrap" style={{ paddingBottom: 32 }}>
    <div className="ad-pagehead"><div className="ad-pagehead__main">
      <h1 className="ad-h1">Login history</h1>
      <p className="ad-sub">Recent successful logins for {selected?.name ?? "this workspace"}.</p>
    </div></div>

    <Notice kind="info">Locations are approximate and depend on your proxy providing IP geolocation. IP addresses are recorded for successful logins only.</Notice>
    {error && <Notice kind="danger">{error}</Notice>}
    {(businessLoading || loading) && <Spinner label="Loading login history…" />}
    {!businessLoading && !loading && !selected && <Empty>Create or select a workspace first.</Empty>}
    {!loading && selected && events.length === 0 && <Empty>No login records yet. New successful logins will appear here.</Empty>}
    {!loading && events.length > 0 && <div className="card" style={{ marginTop: 18, overflowX: "auto" }}>
      <table className="ad-table"><thead><tr>
        <th>User</th><th>Role</th><th>Date and time</th><th>IP address</th><th>Location</th><th>Device</th>
      </tr></thead><tbody>
        {events.map(event => <tr key={event.id}>
          <td><strong>{event.display_name}</strong><div className="ad-login">{event.email || event.username}</div></td>
          <td><span className="ad-badge">{event.role === "owner" ? "Administrator" : "Employee"}</span></td>
          <td>{new Date(event.created_at).toLocaleString()}</td>
          <td><code>{event.ip_address}</code></td>
          <td>{[event.city, event.country].filter(Boolean).join(", ") || "Not available"}</td>
          <td title={event.user_agent}>{deviceLabel(event.user_agent)}</td>
        </tr>)}
      </tbody></table>
    </div>}
  </div>;
}
