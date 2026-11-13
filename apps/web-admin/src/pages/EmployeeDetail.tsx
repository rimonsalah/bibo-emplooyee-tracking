import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  reportActivity,
  reportBrowser,
  reportEmployees,
  reportKeystrokes,
  reportScreenshots,
} from "../api/endpoints";
import type {
  ActivityResponse,
  BrowserVisit,
  KeystrokeBucket,
  ReportEmployee,
  ScreenshotMeta,
} from "../api/types";
import { ActivityPanel } from "../components/reports/ActivityPanel";
import { BrowserPanel } from "../components/reports/BrowserPanel";
import { KeystrokePanel } from "../components/reports/KeystrokePanel";
import { ScreenshotGallery } from "../components/reports/ScreenshotGallery";
import { Notice, Spinner } from "../components/ui";
import { IconCamera, IconClock, StatCard, initials, memberStatus, svg } from "../components/member";
import { dayRangeToUnix, fmtDuration, isoDate } from "../format";
import { useBusinesses } from "../useBusinesses";
import { memberTerms } from "../terms";
import { useAuth } from "../auth/AuthContext";
import { useDetailHeader } from "../detailHeader";

type Tab = "activity" | "keystrokes" | "browser" | "screenshots";
const TABS: Tab[] = ["activity", "keystrokes", "browser", "screenshots"];
// Screenshots per request (backend caps at 200). More load on demand.
const SHOTS_PAGE = 60;

// ── page-specific icons ──────────────────────────────────────────────
const IconChevron = svg(<path d="m9 18 6-6-6-6" />);
const IconCalendar = svg(<><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>);
const IconAppWindow = svg(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 4v4" /><path d="M2 8h20" /><path d="M6 4v4" /></>);
const IconKeyboard = svg(<><path d="M10 8h.01" /><path d="M12 12h.01" /><path d="M14 8h.01" /><path d="M16 12h.01" /><path d="M18 8h.01" /><path d="M6 8h.01" /><path d="M7 16h10" /><path d="M8 12h.01" /><rect width="20" height="16" x="2" y="4" rx="2" /></>);

export function EmployeeDetail() {
  const { t } = useTranslation("dashboard");
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const businessId = params.get("business");
  const { businesses } = useBusinesses();
  const { user } = useAuth();
  const { setTitle } = useDetailHeader();
  const terms = memberTerms(businesses.find((b) => b.id === businessId)?.kind);

  // Single-day view by default; switch to "range" for a custom span.
  const [mode, setMode] = useState<"day" | "range">("day");
  const [day, setDay] = useState(() => isoDate(new Date()));
  const [from, setFrom] = useState(() => isoDate(new Date()));
  const [to, setTo] = useState(() => isoDate(new Date()));

  const [tab, setTab] = useState<Tab>("activity");

  const [employee, setEmployee] = useState<ReportEmployee | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [keystrokes, setKeystrokes] = useState<KeystrokeBucket[] | null>(null);
  const [visits, setVisits] = useState<BrowserVisit[] | null>(null);
  const [shots, setShots] = useState<ScreenshotMeta[] | null>(null);
  // True total for the range (the API pages screenshots); null until loaded.
  const [shotsTotal, setShotsTotal] = useState<number | null>(null);
  const [loadingMoreShots, setLoadingMoreShots] = useState(false);
  // Unix bounds of the currently loaded range, so "load more" pages the same window.
  const rangeRef = useRef<{ from: number; to: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the employee's identity from the roster (for the header). Not in
  // the roster = wrong link, or no access to this member in that business.
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    setEmployee(null);
    setNotFound(false);
    if (!businessId) return;
    let current = true;
    reportEmployees(businessId)
      .then((r) => {
        if (!current) return;
        const found = r.employees.find((e) => e.id === id) ?? null;
        setEmployee(found);
        setNotFound(!found);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [businessId, id]);

  // Push the member's name into the app header (replaces the section label);
  // cleared on unmount so other pages keep their own title.
  useEffect(() => {
    setTitle(employee?.display_name ?? null);
    return () => setTitle(null);
  }, [employee, setTitle]);

  const load = useCallback(async () => {
    if (!id) return;
    const [fromDate, toDate] = mode === "day" ? [day, day] : [from, to];
    const { from: f, to: to2 } = dayRangeToUnix(fromDate, toDate);
    if (f > to2) {
      setError(t("detail.errorStartAfterEnd"));
      return;
    }
    setLoading(true);
    setError(null);
    rangeRef.current = { from: f, to: to2 };
    try {
      const [a, k, b, s] = await Promise.all([
        reportActivity(id, f, to2),
        reportKeystrokes(id, f, to2),
        reportBrowser(id, f, to2),
        reportScreenshots(id, f, to2, SHOTS_PAGE),
      ]);
      setActivity(a);
      setKeystrokes(k.buckets);
      setVisits(b.visits);
      setShots(s.screenshots);
      setShotsTotal(s.total ?? s.screenshots.length);
    } catch {
      setError(t("detail.errorRange"));
    } finally {
      setLoading(false);
    }
  }, [id, mode, day, from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Next page of screenshots for the same range, appended to the gallery.
  const loadMoreShots = useCallback(async () => {
    const range = rangeRef.current;
    if (!id || !range || !shots || loadingMoreShots) return;
    setLoadingMoreShots(true);
    try {
      const s = await reportScreenshots(id, range.from, range.to, SHOTS_PAGE, shots.length);
      // Ignore a late page if the range changed while it was in flight.
      if (rangeRef.current !== range) return;
      setShots((cur) => {
        const seen = new Set((cur ?? []).map((x) => x.client_uuid));
        return [...(cur ?? []), ...s.screenshots.filter((x) => !seen.has(x.client_uuid))];
      });
      if (s.total != null) setShotsTotal(s.total);
    } catch {
      // Keep what's already shown; the "load more" button stays for a retry.
    } finally {
      setLoadingMoreShots(false);
    }
  }, [id, shots, loadingMoreShots]);

  const today = isoDate(new Date());

  // Summary stats for the selected day/range, derived from the loaded data.
  const activeS = activity?.breakdown.reduce((sum, b) => sum + b.duration_s, 0) ?? 0;
  // The API doesn't promise breakdown order — pick the largest explicitly.
  const top = activity?.breakdown.reduce<(typeof activity.breakdown)[number] | null>(
    (best, b) => (!best || b.duration_s > best.duration_s ? b : best),
    null,
  );
  const topApp = top?.app_name ?? "—";
  const topAppS = top?.duration_s ?? 0;
  const keypresses = keystrokes?.reduce((sum, b) => sum + b.count, 0) ?? 0;
  // Top app's share of active time (real).
  const topShare = activeS > 0 ? Math.round((topAppS / activeS) * 100) : 0;
  const periodLabel = mode === "day" ? t("detail.singleDay") : t("detail.dateRange");

  const name = employee?.display_name ?? terms.one;
  // Only the signed-in user is "You" — other administrators also have role owner.
  const isSelf = !!employee && employee.id === user?.id;
  const status = memberStatus(employee?.last_seen ?? null);

  const dateInput = (value: string, onChange: (v: string) => void, min?: string, max?: string) => (
    <input type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
  );

  return (
    <div className="ad-wrap" style={{ paddingBottom: 32 }}>
      {/* breadcrumb */}
      <div className="ad-crumb">
        <Link to="/">{t("detail.breadcrumbDashboard")}</Link>
        <span style={{ display: "inline-flex", lineHeight: 0 }}>{IconChevron}</span>
        <span>{terms.many}</span>
        <span style={{ display: "inline-flex", lineHeight: 0 }}>{IconChevron}</span>
        <span className="ad-crumb__here">{name}</span>
      </div>

      {/* detail header */}
      <div className="ad-detailhead">
        <span className="bibo-avatar" style={{ ["--_s" as string]: "48px" }}>
          <span
            className="bibo-avatar__img"
            aria-label={name}
            style={{ background: "var(--info-soft)", color: "var(--info)" }}
          >
            {initials(name)}
          </span>
          <span className={`bibo-avatar__dot bibo-avatar__dot--${status}`} />
        </span>
        <div className="ad-detailhead__id">
          <div className="ad-detailhead__name">
            {name}
            {isSelf && <span className="ad-self">{t("dashboard.selfBadge")}</span>}
          </div>
          {employee && (
            <div className="ad-detailhead__login">{employee.email || employee.username}</div>
          )}
        </div>

        <div className="ad-datemode">
          <div className="bibo-seg bibo-seg--sm" role="tablist" aria-label={t("detail.dateMode")}>
            <button
              role="tab"
              aria-selected={mode === "day"}
              className={`bibo-seg__opt${mode === "day" ? " bibo-seg__opt--on" : ""}`}
              onClick={() => setMode("day")}
            >
              {t("detail.singleDay")}
            </button>
            <button
              role="tab"
              aria-selected={mode === "range"}
              className={`bibo-seg__opt${mode === "range" ? " bibo-seg__opt--on" : ""}`}
              onClick={() => setMode("range")}
            >
              {t("detail.dateRange")}
            </button>
          </div>

          {mode === "day" ? (
            <span className="ad-datefield">
              <span style={{ display: "inline-flex", lineHeight: 0 }}>{IconCalendar}</span>
              {dateInput(day, setDay, undefined, today)}
            </span>
          ) : (
            <>
              <span className="ad-datefield">
                <span className="ad-datefield__lbl">{t("detail.from")}</span>
                {dateInput(from, setFrom, undefined, to)}
              </span>
              <span className="ad-datefield">
                <span className="ad-datefield__lbl">{t("detail.to")}</span>
                {dateInput(to, setTo, from, today)}
              </span>
            </>
          )}
        </div>
      </div>

      {!businessId && <Notice kind="info">{t("detail.noBusinessContext")}</Notice>}
      {notFound && (
        <Notice kind="danger">{t("detail.notFound", { member: terms.lowerOne, org: terms.org })}</Notice>
      )}
      {error && <Notice kind="danger">{error}</Notice>}

      {/* summary stat cards */}
      <div className="ad-stats">
        <StatCard
          focal
          icon={IconClock}
          label={mode === "day" ? t("detail.summary.activeTime") : t("detail.summary.activeTimeRange")}
          value={fmtDuration(activeS)}
          sub={periodLabel}
        />
        <StatCard
          icon={IconAppWindow}
          label={t("detail.summary.topApp")}
          value={topApp}
          sub={top ? `${topShare}% · ${fmtDuration(topAppS)}` : periodLabel}
        />
        <StatCard
          icon={IconKeyboard}
          label={t("detail.summary.keypresses")}
          value={keypresses.toLocaleString()}
          sub={periodLabel}
        />
        <StatCard
          icon={IconCamera}
          label={t("detail.summary.screenshots")}
          value={(shotsTotal ?? shots?.length ?? 0).toLocaleString()}
          sub={periodLabel}
        />
      </div>

      {/* tabs + panel */}
      <div className="ad-tabwrap">
        <div className="bibo-tabs bibo-tabs--pill" role="tablist">
          {TABS.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`bibo-tab${tab === key ? " bibo-tab--on" : ""}`}
              onClick={() => setTab(key)}
            >
              {t(`detail.tabs.${key}`)}
            </button>
          ))}
        </div>

        <div className="ad-panel">
          {loading ? (
            <Spinner label={t("detail.loadingReports")} />
          ) : (
            !error && (
              <>
                {tab === "activity" &&
                  (activity ? <ActivityPanel data={activity} /> : <Spinner />)}
                {/* Browser panel renders its own table card */}
                {tab === "browser" && (visits ? <BrowserPanel visits={visits} /> : <Spinner />)}
                {(tab === "keystrokes" || tab === "screenshots") && (
                  <div className="bibo-card bibo-card--default ad-cardpad">
                    {tab === "keystrokes" &&
                      (keystrokes ? <KeystrokePanel buckets={keystrokes} /> : <Spinner />)}
                    {tab === "screenshots" &&
                      (shots ? (
                        <ScreenshotGallery
                          shots={shots}
                          total={shotsTotal ?? shots.length}
                          loadingMore={loadingMoreShots}
                          onLoadMore={loadMoreShots}
                        />
                      ) : (
                        <Spinner />
                      ))}
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
