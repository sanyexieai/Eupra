import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Globe,
  ShieldCheck,
  Video,
  Play,
  Download,
  HelpCircle,
  LogOut,
  Sparkles,
  X,
  FolderHeart,
  Lock,
  Settings,
  Check,
} from "lucide-react";
import { api, post, type Version } from "./api";
import zh from "./locales/personal-zh-CN.json";
import en from "./locales/personal-en-US.json";
import "./personal-panels.css";
type Key = keyof typeof zh;
type AppContext = {
  locale: string;
  user: any;
  setUser: (u: any) => void;
  setAuth: (v: boolean) => void;
  setLocale: (v: string) => void;
  applyLocale?: (v: string) => void;
  setNotice: (v: string) => void;
  error: (e: unknown) => void;
  config: any;
  t: (k: any) => string;
};
const useText = (app: AppContext) => (key: Key) =>
  (app.locale === "zh-CN" ? zh : en)[key];
type Profile = {
  user_id: string;
  nickname: string;
  bio: string;
  avatar_asset_id: string | null;
  avatar_url: string | null;
  updated_at: number | null;
};
type CreatorSummary = {
  stats: {
    worlds: number;
    works: number;
    versions: number;
    drafts: number;
    trashed_works: number;
  };
  recent_versions: Version[];
  profile: Profile;
};
type Credits = {
  remaining: number;
  daily_limit: number;
  successful_today: number;
  enabled: boolean;
  timezone?: string;
  next_reset_at?: number | null;
  available_now?: number;
  exhausted?: boolean;
  unavailable_reason?: string;
};
function useCredits(user: any) {
  const [data, setData] = useState<Credits | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    if (user)
      api<Credits>("/me/video-credits")
        .then((v) => {
          if (alive) setData(v);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    return () => {
      alive = false;
    };
  }, [user?.id, refresh]);
  return { data, failed, retry: () => setRefresh((v) => v + 1) };
}
function Sheet({
  title,
  onClose,
  children,
  closeLabel,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button,a[href],input,textarea,select,video",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="pp-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="pp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <button
          className="pp-icon pp-close"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <X size={20} />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Quota({
  app,
  compact = false,
}: {
  app: AppContext;
  compact?: boolean;
}) {
  const t = useText(app);
  const { data, failed, retry } = useCredits(app.user);
  return (
    <div className={compact ? "pp-quota-compact" : "pp-quota"}>
      {!app.user ? (
        <button className="pp-link" onClick={() => app.setAuth(true)}>
          {t("loginCredits")}
          <ArrowRight size={16} />
        </button>
      ) : failed ? (
        <div role="alert">
          <p>{t("loadError")}</p>
          <button className="pp-link" onClick={retry}>
            {t("retry")}
          </button>
        </div>
      ) : !data ? (
        <span role="status">{t("loading")}</span>
      ) : (
        <>
          <span>{t("remaining")}</span>
          <strong>
            {data.remaining}
            <small> / {data.daily_limit}</small>
          </strong>
        </>
      )}
    </div>
  );
}
export function ProfileSettings({ app }: { app: AppContext }) {
  const t = useText(app);
  const [works, setWorks] = useState<Version[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<CreatorSummary | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [sheet, setSheet] = useState<"account" | "help" | "about" | null>(null);
  useEffect(() => {
    let alive = true;
    setWorks(null);
    setProfile(null);
    setSummary(null);
    setSettings(null);
    setFailed(false);
    setSettingsFailed(false);
    if (app.user) {
      api<CreatorSummary>("/me/creator-summary")
        .then((r) => {
          if (!r.stats || !Array.isArray(r.recent_versions) || !r.profile)
            throw new Error("Invalid creator summary");
          if (alive) {
            setWorks(r.recent_versions);
            setSummary(r);
            setProfile(r.profile);
          }
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
      api("/me/settings")
        .then((r) => {
          if (alive) setSettings(r);
        })
        .catch(() => {
          if (alive) setSettingsFailed(true);
        });
    }
    return () => {
      alive = false;
    };
  }, [app.user?.id, reload]);
  const save = async (value: Record<string, unknown>) => {
    setBusy(true);
    try {
      const next = await api("/me/settings", {
        method: "PATCH",
        body: JSON.stringify(value),
      });
      setSettings(next);
      if (
        value.locale &&
        (next.locale === "en" ||
          next.locale === "en-US" ||
          next.locale === "zh-CN")
      )
        (app.applyLocale || app.setLocale)(
          next.locale === "zh-CN" ? "zh-CN" : "en-US",
        );
      app.setNotice(t("saved"));
    } catch {
      app.setNotice(t("saveError"));
    } finally {
      setBusy(false);
    }
  };
  const counts = summary?.stats
    ? [summary.stats.worlds, summary.stats.works, summary.stats.versions]
    : null;
  return (
    <main className="pp-profile">
      <div className="pp-topline">
        <span>
          <img src="/assets/logo.png" alt="" />
          {t("mine")}
        </span>
        <a
          href="#personal-preferences"
          className="pp-icon"
          aria-label={t("settings")}
        >
          <Settings size={22} />
        </a>
      </div>
      <div className="pp-profile-heading">
        <div className="pp-avatar">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={t("avatar")} />
          ) : (
            "✦"
          )}
        </div>
        <div>
          <small>{t("profile")}</small>
          <h1>{profile?.nickname || app.user?.email || t("guest")}</h1>
          <p>{profile?.bio || t("profileBody")}</p>
        </div>
        {app.user ? (
          <button
            className="pp-light-button"
            onClick={() => setSheet("account")}
          >
            {t("editProfile")}
          </button>
        ) : (
          <button className="pp-light-button" onClick={() => app.setAuth(true)}>
            {t("login")}
          </button>
        )}
      </div>
      <section className="pp-life-hero">
        <div className="pp-life-copy">
          <small>{t("private")}</small>
          <h2>{t("heroTitle")}</h2>
          <p>{t("heroBody")}</p>
          <Link className="pp-gradient-button" to="/create">
            {t("create")}
            <ArrowRight size={19} />
          </Link>
        </div>
        <div className="pp-collage" aria-hidden="true">
          <img src="/assets/golden-girl.webp" alt="" />
          <img src="/assets/cat-moon-hero.webp" alt="" />
          <img src="/assets/cat-ceo-hero.webp" alt="" />
        </div>
        <span className="pp-example-label">{t("examples")}</span>
      </section>
      <div className="pp-stats">
        {(["worlds", "works", "versions"] as Key[]).map((k, i) => (
          <div key={k}>
            <strong>{counts ? String(counts[i]).padStart(2, "0") : "—"}</strong>
            <span>{t(k)}</span>
          </div>
        ))}
      </div>
      <section className="pp-recents">
        <div className="pp-section-heading">
          <h2>{t("recent")}</h2>
          <Link to="/works">
            {t("allWorks")}
            <ChevronRight size={16} />
          </Link>
        </div>
        {failed ? (
          <div className="pp-empty" role="alert">
            <p>{t("loadError")}</p>
            <button onClick={() => setReload((v) => v + 1)}>
              {t("retry")}
            </button>
          </div>
        ) : app.user && !works ? (
          <p role="status">{t("loading")}</p>
        ) : works?.length ? (
          <div className="pp-recent-grid">
            {works.slice(0, 3).map((v) => (
              <Link key={v.id} to={"/versions/" + v.id}>
                <div>
                  {v.image_url ? (
                    <img src={v.image_url} alt="" />
                  ) : (
                    <Sparkles size={36} />
                  )}
                  <strong>{v.title}</strong>
                </div>
                <p>{v.caption}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="pp-empty">
            <Sparkles size={24} />
            <h3>{t("empty")}</h3>
            <p>{t("emptyBody")}</p>
            <Link to="/create">
              {t("create")}
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
      <section className="pp-credit-link">
        <Video size={23} />
        <div>
          <h3>{t("credits")}</h3>
          <p>{t("creditBody")}</p>
          <Quota app={app} compact />
        </div>
        <Link to="/balance" className="pp-icon" aria-label={t("credits")}>
          <ChevronRight />
        </Link>
      </section>
      <section className="pp-settings" id="personal-preferences">
        <h2>{t("settings")}</h2>
        <div className="pp-settings-list">
          <div className="pp-row">
            <span>
              <Globe size={20} />
              {t("language")}
            </span>
            <select
              aria-label={t("language")}
              value={app.locale}
              disabled={busy || (!!app.user && !settings)}
              onChange={(e) => {
                if (app.user)
                  save({ locale: e.target.value === "en-US" ? "en" : "zh-CN" });
                else app.setLocale(e.target.value);
              }}
            >
              <option value="zh-CN">{t("zh")}</option>
              <option value="en-US">{t("en")}</option>
            </select>
          </div>
          {app.user && (
            <>
              <div className="pp-row pp-remix-row">
                <div>
                  <span>
                    <Lock size={20} />
                    {t("remix")}
                  </span>
                  <p>{t("remixBody")}</p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={t("remix")}
                  checked={!!settings?.default_remix_allowed}
                  disabled={busy || !settings}
                  onChange={(e) =>
                    save({ default_remix_allowed: e.target.checked })
                  }
                />
              </div>
              {settingsFailed && (
                <div className="pp-settings-error" role="alert">
                  <p>{t("settingsReadError")}</p>
                  <button onClick={() => setReload((v) => v + 1)}>
                    {t("retry")}
                  </button>
                </div>
              )}
            </>
          )}
          {app.user && typeof settings?.notifications_enabled === "boolean" && (
            <div className="pp-row pp-remix-row">
              <div>
                <span>{t("notifications")}</span>
                <p>{t("notificationNote")}</p>
              </div>
              <input
                type="checkbox"
                role="switch"
                aria-label={t("notifications")}
                checked={settings.notifications_enabled}
                disabled={busy}
                onChange={(e) =>
                  save({ notifications_enabled: e.target.checked })
                }
              />
            </div>
          )}
          <Link className="pp-row" to="/works">
            <span>
              <FolderHeart size={20} />
              {t("works")}
            </span>
            <ChevronRight size={18} />
          </Link>
          {(["help", "about"] as const).map((k) => (
            <button className="pp-row" key={k} onClick={() => setSheet(k)}>
              <span>
                {k === "help" ? (
                  <HelpCircle size={20} />
                ) : (
                  <ShieldCheck size={20} />
                )}{" "}
                {t(k)}
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        {app.user && (
          <button
            className="pp-logout"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await post("/auth/logout");
                app.setUser(null);
              } catch (e) {
                app.error(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={17} />
            {t("logout")}
          </button>
        )}
      </section>
      {sheet && (
        <Sheet
          title={t(sheet)}
          closeLabel={t("close")}
          onClose={() => setSheet(null)}
        >
          {sheet === "account" ? (
            <>
              <strong>{app.user?.email}</strong>
              {profile ? (
                <ProfileEditor
                  app={app}
                  profile={profile}
                  onSaved={(value) => {
                    setProfile(value);
                    setSheet(null);
                  }}
                />
              ) : (
                <p>{t(failed ? "loadError" : "loading")}</p>
              )}
            </>
          ) : (
            <p>{t((sheet + "Body") as Key)}</p>
          )}
          {sheet === "help" && app.user && <AppealRecords app={app} />}
        </Sheet>
      )}
    </main>
  );
}
export function VideoStudio({
  app,
  version,
}: {
  app: AppContext;
  version: Version;
}) {
  const t = useText(app);
  const [action, setAction] = useState("action1");
  const [custom, setCustom] = useState("");
  const [motionLoaded, setMotionLoaded] = useState(false);
  const [motionFailed, setMotionFailed] = useState(false);
  const [motionBusy, setMotionBusy] = useState(false);
  const [motionRefresh, setMotionRefresh] = useState(0);
  const motionSource = useRef(version.id);
  useEffect(() => {
    let active = true;
    motionSource.current = version.id;
    setMotionLoaded(false);
    setMotionFailed(false);
    setMotionBusy(false);
    setAction("action1");
    setCustom("");
    api<{ preset: string; custom_text: string }>(
      "/versions/" + encodeURIComponent(version.id) + "/motion-preference",
    )
      .then((value) => {
        if (!active) return;
        const map: Record<string, string> = {
          gentle: "action1",
          dynamic: "action2",
          cinematic: "action3",
          custom: "custom",
        };
        setAction(map[value.preset] || "action1");
        setCustom(value.custom_text || "");
        setMotionLoaded(true);
      })
      .catch(() => {
        if (active) setMotionFailed(true);
      });
    return () => {
      active = false;
    };
  }, [version.id, motionRefresh]);
  const saveMotion = async () => {
    if (!motionLoaded || motionBusy) return;
    const source = version.id;
    setMotionBusy(true);
    try {
      const map: Record<string, string> = {
        action1: "gentle",
        action2: "dynamic",
        action3: "cinematic",
        custom: "custom",
      };
      await api(
        "/versions/" + encodeURIComponent(source) + "/motion-preference",
        {
          method: "PATCH",
          body: JSON.stringify({ preset: map[action], custom_text: custom }),
        },
      );
      if (motionSource.current === source) app.setNotice(t("motionSaved"));
    } catch {
      if (motionSource.current === source) app.setNotice(t("saveError"));
    } finally {
      if (motionSource.current === source) setMotionBusy(false);
    }
  };

  const [demo, setDemo] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const demoVideo = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    setMediaFailed(false);
  }, [app.locale, demo]);
  const src =
    "/assets/cn12_cinematic_demo_5s" +
    (app.locale === "zh-CN" ? "" : "_en") +
    ".mp4";
  return (
    <main className="pp-video pp-dark">
      <div className="pp-topline">
        <Link
          className="pp-icon"
          to={"/versions/" + version.id}
          aria-label={t("back")}
        >
          <ArrowLeft />
        </Link>
        <strong>{t("video")}</strong>
        <Link
          className="pp-credit-pill"
          to={"/balance?version=" + encodeURIComponent(version.id)}
        >
          {t("credits")}
          <ChevronRight size={16} />
        </Link>
      </div>
      <div className="pp-video-intro">
        <small>{t("format")}</small>
        <h1>{t("videoTitle")}</h1>
        <p>{t("videoSubtitle")}</p>
      </div>
      <div className="pp-video-layout">
        <section className="pp-video-art">
          <div className="pp-video-image">
            {version.image_url ? (
              <img src={version.image_url} alt={version.title} />
            ) : (
              <div className="pp-no-image">
                <Sparkles size={50} />
                <p>{t("noImage")}</p>
              </div>
            )}
            <span className="pp-source-tag">{t("current")}</span>
            <div className="pp-video-caption">
              <small>{t("current")}</small>
              <h2>{version.title}</h2>
              <p>{version.caption}</p>
            </div>
          </div>
          <Link className="pp-source-row" to={"/versions/" + version.id}>
            <ShieldCheck size={20} />
            <span>{t("source")}</span>
            <ChevronRight size={18} />
          </Link>
        </section>
        <section className="pp-motion">
          <small>{t("actionHint")}</small>
          <h2>{t("actionTitle")}</h2>
          <div className="pp-action-options">
            {(["action1", "action2", "action3", "custom"] as const).map((k) => (
              <button
                key={k}
                aria-pressed={action === k}
                disabled={motionBusy || (!motionLoaded && !motionFailed)}
                className={action === k ? "active" : ""}
                onClick={() => setAction(k)}
              >
                {t(k)}
              </button>
            ))}
          </div>
          {action === "custom" && (
            <div className="pp-custom">
              <textarea
                aria-label={t("custom")}
                placeholder={t("customPlaceholder")}
                maxLength={150}
                disabled={motionBusy || (!motionLoaded && !motionFailed)}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <small>{custom.length}/150</small>
            </div>
          )}
          {motionFailed && (
            <div className="pp-unavailable" role="alert">
              <p>{t("motionLoadFailed")}</p>
              <button
                className="pp-link"
                onClick={() => setMotionRefresh((v) => v + 1)}
              >
                {t("retry")}
              </button>
            </div>
          )}
          <button
            className="pp-link pp-motion-save"
            disabled={!motionLoaded || motionBusy}
            onClick={saveMotion}
          >
            {t("motionSave")}
            <Check size={16} />
          </button>
          <p className="pp-demo-note">{t("motionSavedNote")}</p>
          <Quota app={app} />
          <p className="pp-muted">{t("creditBody")}</p>
          <div className="pp-unavailable" role="status">
            <ShieldCheck size={21} />
            <div>
              <strong>{t("unavailable")}</strong>
              <p>{t("unavailableBody")}</p>
            </div>
          </div>
          <button
            className="pp-gradient-button pp-wide"
            onClick={() => setDemo(true)}
          >
            <Play size={19} />
            {t("demo")}
            <ArrowRight size={19} />
          </button>
          <p className="pp-demo-note">{t("demoBody")}</p>
        </section>
      </div>
      {demo && (
        <Sheet
          title={t("demoTitle")}
          closeLabel={t("close")}
          onClose={() => setDemo(false)}
        >
          <p>{t("demoBody")}</p>
          <video
            key={src}
            ref={demoVideo}
            controls
            playsInline
            preload="metadata"
            aria-label={t("demoTitle")}
            onError={() => setMediaFailed(true)}
            onPlaying={() => setMediaFailed(false)}
          >
            <source src={src.replace(/\.mp4$/, ".webm")} type="video/webm" />
            <source
              src={src}
              type="video/mp4"
              onError={() => setMediaFailed(true)}
            />
          </video>
          {mediaFailed && (
            <p className="pp-unavailable" role="alert">
              {t("demoPlaybackError")}
            </p>
          )}
          <button
            className="pp-light-button"
            onClick={async () => {
              try {
                if (!demoVideo.current) throw new Error("Media unavailable");
                await demoVideo.current.play();
              } catch {
                setMediaFailed(true);
              }
            }}
          >
            <Play size={18} />
            {t("demoPlay")}
          </button>
          <a className="pp-gradient-button" href={src} download>
            <Download size={18} />
            {t("download")}
          </a>
        </Sheet>
      )}
    </main>
  );
}
export function VideoBalance({ app }: { app: AppContext }) {
  const t = useText(app);
  const [params] = useSearchParams();
  const sourceId = params.get("version");
  const [source, setSource] = useState<Version | null>(null);
  const [sourceFailed, setSourceFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSource(null);
    setSourceFailed(false);
    if (sourceId && app.user)
      api<Version>("/versions/" + encodeURIComponent(sourceId))
        .then((value) => {
          if (active) setSource(value);
        })
        .catch(() => {
          if (active) setSourceFailed(true);
        });
    return () => {
      active = false;
    };
  }, [sourceId, app.user?.id]);
  const returnPath = source
    ? "/video/" + encodeURIComponent(source.id)
    : "/settings";
  const { data, failed, retry } = useCredits(app.user);
  const [sheet, setSheet] = useState<"policy" | "membership" | null>(null);
  return (
    <main className="pp-balance pp-dark">
      <div className="pp-topline">
        <Link className="pp-icon" to={returnPath} aria-label={t("back")}>
          <ArrowLeft />
        </Link>
        <strong>{t("credits")}</strong>
        <Globe size={21} />
      </div>
      <section className="pp-balance-hero">
        <small>{t("balanceKicker")}</small>
        <h1>{t("balanceTitle")}</h1>
        <p>{t("balanceSubtitle")}</p>
        <div className="pp-credit-ring">
          <div>
            <span>{t("remaining")}</span>
            <strong>
              {data ? data.remaining : "—"}
              <small>{t("times")}</small>
            </strong>
            <span>{t("duration")}</span>
          </div>
        </div>
      </section>
      {!app.user ? (
        <button
          className="pp-gradient-button pp-wide"
          onClick={() => app.setAuth(true)}
        >
          {t("loginCredits")}
          <ArrowRight size={18} />
        </button>
      ) : failed ? (
        <div className="pp-unavailable" role="alert">
          <p>{t("loadError")}</p>
          <button className="pp-link" onClick={retry}>
            {t("retry")}
          </button>
        </div>
      ) : !data ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <section className="pp-balance-card">
          <div className="pp-section-heading">
            <h2>{t("today")}</h2>
            <span className="pp-status">
              {t(data.enabled ? "quotaAvailable" : "statusOff")}
            </span>
          </div>
          <p>{t("creditBody")}</p>
          <div
            className="pp-credit-segments"
            aria-hidden="true"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, Math.min(100, Math.floor(data.daily_limit)))}, minmax(0, 1fr))`,
            }}
          >
            {Array.from(
              {
                length: Math.max(
                  0,
                  Math.min(100, Math.floor(data.daily_limit)),
                ),
              },
              (_, index) => (
                <span
                  key={index}
                  className={index < data.remaining ? "available" : "used"}
                />
              ),
            )}
          </div>
          <progress
            className="pp-credit-progress-accessible"
            aria-label={t("remaining")}
            max={Math.max(1, data.daily_limit)}
            value={data.remaining}
          />
          <div className="pp-balance-numbers">
            <span>
              {t("limit")} · {data.daily_limit}
            </span>
            <span>
              {t("used")} · {data.successful_today}
            </span>
          </div>
          <p className="pp-muted">{t("quotaNote")}</p>
          {data.exhausted === true && (
            <p className="pp-exhausted" role="status">
              {t("exhausted")}
            </p>
          )}
          {typeof data.available_now === "number" && (
            <p className="pp-muted">
              {t("availableNow")} · {data.available_now}
            </p>
          )}
          <ServerReset data={data} locale={app.locale} t={t} />

          <button className="pp-link" onClick={() => setSheet("policy")}>
            {t("policy")}
            <ChevronRight size={16} />
          </button>
        </section>
      )}
      {sourceFailed && (
        <p className="pp-muted" role="alert">
          {t("loadError")}
        </p>
      )}
      <Link
        className="pp-continue-card"
        to={source ? "/video/" + encodeURIComponent(source.id) : "/works"}
      >
        <div className="pp-continue-orb">
          <img src={source?.image_url || "/assets/orb-mark.svg"} alt="" />
        </div>
        <div>
          <small>{t("private")}</small>
          <h2>{source?.title || t("chooseWork")}</h2>
          <p>{t("unavailable")}</p>
          <span className="pp-gradient-button">
            {t(source ? "video" : "allWorks")}
            <ArrowRight size={18} />
          </span>
        </div>
      </Link>
      <section className="pp-membership">
        <Sparkles size={32} />
        <small>{t("membership")}</small>
        <h2>{t("membershipTitle")}</h2>
        <p>{t("membershipBody")}</p>
        <button
          className="pp-light-button"
          onClick={() => setSheet("membership")}
        >
          {t("learn")}
          <ArrowRight size={17} />
        </button>
      </section>
      <section className="pp-faq">
        <h2>{t("faq")}</h2>
        {(["faq1", "faq2"] as const).map((k) => (
          <details key={k}>
            <summary>{t(k)}</summary>
            <p>{t((k + "Body") as Key)}</p>
          </details>
        ))}
      </section>
      {sheet && (
        <Sheet
          title={t(sheet)}
          closeLabel={t("close")}
          onClose={() => setSheet(null)}
        >
          <p>{t((sheet + "Body") as Key)}</p>
        </Sheet>
      )}
    </main>
  );
}

function ProfileEditor({
  app,
  profile,
  onSaved,
}: {
  app: AppContext;
  profile: Profile;
  onSaved: (value: Profile) => void;
}) {
  const t = useText(app);
  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(profile.bio);
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [preview, setPreview] = useState(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview(remove ? null : profile.avatar_url);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, remove, profile.avatar_url]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      let avatar_asset_id = remove ? null : profile.avatar_asset_id;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const result = await api<{ id: string }>("/uploads", {
          method: "POST",
          body: form,
        });
        avatar_asset_id = result.id;
      }
      const next = await api<Profile>("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ nickname, bio, avatar_asset_id }),
      });
      onSaved(next);
      app.setNotice(t("profileSaved"));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="pp-profile-editor" onSubmit={submit}>
      <div className="pp-edit-avatar">
        {preview ? (
          <img src={preview} alt={t("avatar")} />
        ) : (
          <Sparkles size={30} />
        )}
      </div>
      <label>
        {t("chooseAvatar")}
        <input
          type="file"
          accept={(
            app.config?.upload?.mime_types || [
              "image/jpeg",
              "image/png",
              "image/webp",
            ]
          ).join(",")}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const types = app.config?.upload?.mime_types || [
              "image/jpeg",
              "image/png",
              "image/webp",
            ];
            if (
              !types.includes(f.type) ||
              f.size > (app.config?.upload?.max_bytes || 10485760)
            ) {
              app.setNotice(t("avatarInvalid"));
              return;
            }
            setFile(f);
            setRemove(false);
          }}
        />
      </label>
      <button
        type="button"
        className="pp-link"
        disabled={busy}
        onClick={() => {
          setFile(null);
          setRemove(true);
        }}
      >
        {t("removeAvatar")}
      </button>
      <label>
        {t("nickname")}
        <input
          value={nickname}
          maxLength={40}
          disabled={busy}
          onChange={(e) => setNickname(e.target.value)}
        />
      </label>
      <label>
        {t("bio")}
        <textarea
          value={bio}
          maxLength={500}
          disabled={busy}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      {failed && <p role="alert">{t("profileFailed")}</p>}
      <button
        type="submit"
        className="pp-gradient-button pp-wide"
        disabled={busy}
      >
        {t("saveProfile")}
        <Check size={17} />
      </button>
    </form>
  );
}

type Appeal = {
  id: string;
  version_id: string;
  reason: string;
  status: string;
  created_at: number;
};
function AppealRecords({ app }: { app: AppContext }) {
  const t = useText(app);
  const [records, setRecords] = useState<Appeal[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [works, setWorks] = useState<Version[] | null>(null);
  const [worksFailed, setWorksFailed] = useState(false);
  const [worksRefresh, setWorksRefresh] = useState(0);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    let active = true;
    setWorks(null);
    setWorksFailed(false);
    setSelected("");
    api<{ items: Version[] }>("/me/works?state=all")
      .then((value) => {
        if (!Array.isArray(value.items))
          throw new Error("Invalid works response");
        if (!active) return;
        const owned = value.items.filter(
          (work) => work.creator_id === app.user?.id,
        );
        setWorks(owned);
        setSelected(owned[0]?.id || "");
      })
      .catch(() => {
        if (active) setWorksFailed(true);
      });
    return () => {
      active = false;
    };
  }, [app.user?.id, worksRefresh]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    api<{ items: Appeal[] }>("/me/appeals")
      .then((value) => {
        if (active) setRecords(value.items);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [app.user?.id, refresh]);
  return (
    <section className="pp-appeals">
      <h3>{t("appeals")}</h3>
      <p>{t("appealNote")}</p>
      {failed ? (
        <div role="alert">
          <p>{t("loadError")}</p>
          <button className="pp-link" onClick={() => setRefresh((v) => v + 1)}>
            {t("retry")}
          </button>
        </div>
      ) : records === null ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <>
          {records.length ? (
            <ul>
              {records.map((record) => (
                <li key={record.id}>
                  <strong>{t("appealPending")}</strong>
                  <p>{record.reason}</p>
                  <small>
                    {new Date(record.created_at * 1000).toLocaleString(
                      app.locale,
                    )}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("appealEmpty")}</p>
          )}
          {worksFailed ? (
            <div role="alert">
              <p>{t("appealWorksError")}</p>
              <button
                className="pp-link"
                onClick={() => setWorksRefresh((v) => v + 1)}
              >
                {t("retry")}
              </button>
            </div>
          ) : works === null ? (
            <p role="status">{t("loading")}</p>
          ) : works.length ? (
            <form
              className="pp-profile-editor"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  busy ||
                  !works.some((work) => work.id === selected) ||
                  !reason.trim()
                )
                  return;
                setBusy(true);
                setSubmitFailed(false);
                try {
                  await post("/me/appeals", {
                    version_id: selected,
                    reason: reason.trim(),
                  });
                  setReason("");
                  setRefresh((v) => v + 1);
                  app.setNotice(t("appealSaved"));
                } catch {
                  setSubmitFailed(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t("appealVersion")}
                <select
                  disabled={busy}
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {works.map((work) => (
                    <option value={work.id} key={work.id}>
                      {work.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("appealReason")}
                <textarea
                  disabled={busy}
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {submitFailed && <p role="alert">{t("saveError")}</p>}
              <button
                className="pp-gradient-button pp-wide"
                disabled={busy || !reason.trim()}
              >
                {t("appealSend")}
              </button>
            </form>
          ) : (
            <p>{t("noOwnedWorks")}</p>
          )}
        </>
      )}
    </section>
  );
}

function ServerReset({
  data,
  locale,
  t,
}: {
  data: Credits;
  locale: string;
  t: (key: Key) => string;
}) {
  let value = "";
  if (
    typeof data.next_reset_at === "number" &&
    Number.isFinite(data.next_reset_at)
  ) {
    const date = new Date(data.next_reset_at * 1000);
    if (!Number.isNaN(date.getTime())) {
      try {
        value = new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: data.timezone || "UTC",
        }).format(date);
      } catch {
        value = date.toISOString();
      }
    }
  }
  return (
    <div className="pp-reset-details">
      {value && (
        <p>
          {t("resetAt")} ·{" "}
          <time dateTime={new Date(data.next_reset_at! * 1000).toISOString()}>
            {value}
          </time>
        </p>
      )}
      {data.timezone && (
        <p>
          {t("resetTimezone")} · {data.timezone}
        </p>
      )}
      {value && <p>{t("resetPolicyNote")}</p>}
    </div>
  );
}
