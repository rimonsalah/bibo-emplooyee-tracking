import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createAdministrator, listAdministrators, removeAdministrator } from "../api/endpoints";
import { ApiError, type Administrator } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Empty, Modal, Notice, Spinner } from "../components/ui";
import { useBusinesses } from "../useBusinesses";
import { memberTerms } from "../terms";

const blank = { display_name: "", login: "", password: "" };
type Message = { kind: "success" | "danger"; text: string };

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export function Administrators() {
  const { t } = useTranslation("settings");
  const { user } = useAuth();
  const { selected, selectedId, loading: businessLoading } = useBusinesses();
  const terms = memberTerms(selected?.kind);
  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirming, setConfirming] = useState<Administrator | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const isPrimary = !!selected && selected.owner_user_id === user?.id;
  const workspace = selected?.name ?? t("admins.thisWorkspace");

  // Loads the list for `businessId`. `isCurrent` lets a caller drop a late
  // response after the user switched business.
  const fetchAdmins = useCallback(
    async (businessId: string, isCurrent: () => boolean = () => true) => {
      setLoading(true);
      try {
        const result = await listAdministrators(businessId);
        if (isCurrent()) setAdmins(result.administrators);
      } catch (err) {
        if (isCurrent()) setMessage({ kind: "danger", text: errText(err, t("admins.errorLoad")) });
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    setAdmins([]);
    setMessage(null);
    if (!selectedId) return;
    let current = true;
    void fetchAdmins(selectedId, () => current);
    return () => {
      current = false;
    };
  }, [selectedId, fetchAdmins]);

  async function remove(admin: Administrator) {
    if (!selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      await removeAdministrator(selectedId, admin.id);
      setMessage({ kind: "success", text: t("admins.removed") });
      setConfirming(null);
      await fetchAdmins(selectedId);
    } catch (err) {
      setMessage({ kind: "danger", text: errText(err, t("admins.errorRemove")) });
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ad-wrap" style={{ paddingBottom: 32 }}>
      <div className="ad-pagehead">
        <div className="ad-pagehead__main">
          <h1 className="ad-h1">{t("admins.title")}</h1>
          <p className="ad-sub">{t("admins.subtitle", { name: workspace })}</p>
        </div>
        {isPrimary && (
          <button className="bibo-btn bibo-btn--primary" onClick={() => setShowForm(true)}>
            {t("admins.add")}
          </button>
        )}
      </div>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {!isPrimary && selected && (
        <Notice kind="info">{t("admins.onlyPrimary", { members: terms.lowerMany })}</Notice>
      )}

      {(businessLoading || loading) && <Spinner label={t("admins.loading")} />}
      {!businessLoading && !loading && !selected && <Empty>{t("admins.noWorkspace")}</Empty>}
      {!loading && selected && admins.length > 0 && (
        <div className="bibo-card bibo-card--default ad-tablecard" style={{ marginTop: 18 }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th>{t("admins.table.name")}</th>
                <th>{t("admins.table.login")}</th>
                <th>{t("admins.table.access")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <strong>{admin.display_name}</strong>
                  </td>
                  <td className="ad-login">{admin.email || admin.username}</td>
                  <td>
                    <span className={`ad-badge${admin.primary ? " ad-badge--primary" : ""}`}>
                      {admin.primary ? t("admins.primary") : t("admins.admin")}
                    </span>
                  </td>
                  <td className="r">
                    {isPrimary && !admin.primary && (
                      <button
                        className="bibo-btn bibo-btn--secondary bibo-btn--sm"
                        disabled={busy}
                        onClick={() => setConfirming(admin)}
                      >
                        {t("admins.remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && selectedId && (
        <NewAdminModal
          businessId={selectedId}
          onClose={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            setMessage({ kind: "success", text: t("admins.created") });
            await fetchAdmins(selectedId);
          }}
        />
      )}

      {confirming && (
        <Modal title={t("admins.confirmTitle")} onClose={() => !busy && setConfirming(null)}>
          <p>{t("admins.confirmBody", { name: confirming.display_name, workspace })}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="bibo-btn bibo-btn--ghost"
              disabled={busy}
              onClick={() => setConfirming(null)}
            >
              {t("admins.cancel")}
            </button>
            <button
              type="button"
              className="bibo-btn bibo-btn--primary"
              disabled={busy}
              onClick={() => void remove(confirming)}
            >
              {t("admins.confirmRemove")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NewAdminModal({
  businessId,
  onClose,
  onCreated,
}: {
  businessId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const { t } = useTranslation("settings");
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const login = form.login.trim();
    const isEmail = login.includes("@");
    try {
      await createAdministrator(businessId, {
        display_name: form.display_name.trim(),
        email: isEmail ? login : undefined,
        username: isEmail ? undefined : login.toLowerCase(),
        password: form.password,
      });
      await onCreated();
    } catch (err) {
      setError(errText(err, t("admins.errorCreate")));
      setBusy(false);
    }
  }

  return (
    <Modal wide onClose={onClose}>
      <div className="bibo-dlg" role="dialog" aria-modal="true" aria-labelledby="new-admin-title">
        <div className="bibo-dlg__head">
          <div className="bibo-dlg__title" id="new-admin-title">
            {t("admins.formTitle")}
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="bibo-dlg__body">
            {error && (
              <div style={{ marginBottom: 12 }}>
                <Notice kind="danger">{error}</Notice>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="bibo-field">
                <span className="bibo-field__lbl">{t("admins.fullName")}</span>
                <span className="bibo-input">
                  <input
                    required
                    autoFocus
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  />
                </span>
              </label>
              <label className="bibo-field">
                <span className="bibo-field__lbl">{t("admins.login")}</span>
                <span className="bibo-input">
                  <input
                    required
                    autoComplete="off"
                    value={form.login}
                    onChange={(e) => setForm({ ...form, login: e.target.value })}
                  />
                </span>
              </label>
              <label className="bibo-field">
                <span className="bibo-field__lbl">{t("admins.tempPassword")}</span>
                <span className="bibo-input">
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </span>
              </label>
            </div>
          </div>
          <div className="bibo-dlg__foot">
            <button type="button" className="bibo-btn bibo-btn--ghost" onClick={onClose}>
              {t("admins.cancel")}
            </button>
            <button className="bibo-btn bibo-btn--primary" disabled={busy}>
              {busy ? t("admins.creating") : t("admins.create")}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
