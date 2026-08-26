import { useEffect, useState } from "react";
import { createAdministrator, listAdministrators, removeAdministrator } from "../api/endpoints";
import { ApiError, type Administrator } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Empty, Notice, Spinner } from "../components/ui";
import { useBusinesses } from "../useBusinesses";

const blank = { display_name: "", login: "", password: "" };

export function Administrators() {
  const { user } = useAuth();
  const { selected, selectedId, loading: businessLoading } = useBusinesses();
  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const isPrimary = !!selected && selected.owner_user_id === user?.id;

  async function reload() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const result = await listAdministrators(selectedId);
      setAdmins(result.administrators);
    } catch (err) {
      setMessage({ kind: "danger", text: err instanceof ApiError ? err.message : "Could not load administrators." });
    } finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, [selectedId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || busy) return;
    setBusy(true); setMessage(null);
    const isEmail = form.login.includes("@");
    try {
      await createAdministrator(selectedId, {
        display_name: form.display_name.trim(),
        email: isEmail ? form.login.trim() : undefined,
        username: isEmail ? undefined : form.login.trim().toLowerCase(),
        password: form.password,
      });
      setForm(blank); setShowForm(false);
      setMessage({ kind: "success", text: "Administrator created. Share the login and temporary password securely." });
      await reload();
    } catch (err) {
      setMessage({ kind: "danger", text: err instanceof ApiError ? err.message : "Could not create administrator." });
    } finally { setBusy(false); }
  }

  async function remove(admin: Administrator) {
    if (!selectedId || !confirm(`Remove administrator access for ${admin.display_name}?`)) return;
    setBusy(true); setMessage(null);
    try {
      await removeAdministrator(selectedId, admin.id);
      setMessage({ kind: "success", text: "Administrator access removed." });
      await reload();
    } catch (err) {
      setMessage({ kind: "danger", text: err instanceof ApiError ? err.message : "Could not remove administrator." });
    } finally { setBusy(false); }
  }

  return <div className="ad-wrap" style={{ paddingBottom: 32 }}>
    <div className="ad-pagehead"><div className="ad-pagehead__main">
      <h1 className="ad-h1">Administrators</h1>
      <p className="ad-sub">Give trusted managers separate access to {selected?.name ?? "this workspace"}.</p>
    </div>{isPrimary && <button className="bibo-btn bibo-btn--primary" onClick={() => setShowForm(v => !v)}>{showForm ? "Cancel" : "Add administrator"}</button>}</div>

    {message && <Notice kind={message.kind}>{message.text}</Notice>}
    {!isPrimary && selected && <Notice kind="info">Only the primary owner can add or remove administrators. You still have full access to employees, reports, and settings.</Notice>}

    {showForm && <form className="card" onSubmit={submit} style={{ padding: 22, marginTop: 18, display: "grid", gap: 14, maxWidth: 620 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>New administrator</h2>
      <label className="field"><span>Full name</span><input required value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
      <label className="field"><span>Email or username</span><input required value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} /></label>
      <label className="field"><span>Temporary password</span><input required minLength={8} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      <div><button className="bibo-btn bibo-btn--primary" disabled={busy}>{busy ? "Creating…" : "Create administrator"}</button></div>
    </form>}

    {(businessLoading || loading) && <Spinner label="Loading administrators…" />}
    {!businessLoading && !loading && !selected && <Empty>Create or select a workspace first.</Empty>}
    {!loading && selected && <div className="card" style={{ marginTop: 18, overflow: "hidden" }}>
      <table className="ad-table"><thead><tr><th>Name</th><th>Login</th><th>Access</th><th /></tr></thead><tbody>
        {admins.map(admin => <tr key={admin.id}>
          <td><strong>{admin.display_name}</strong></td>
          <td>{admin.email || admin.username}</td>
          <td><span className="ad-badge">{admin.primary ? "Primary owner" : "Administrator"}</span></td>
          <td style={{ textAlign: "right" }}>{isPrimary && !admin.primary && <button className="bibo-btn bibo-btn--secondary bibo-btn--sm" disabled={busy} onClick={() => void remove(admin)}>Remove</button>}</td>
        </tr>)}
      </tbody></table>
    </div>}
  </div>;
}
