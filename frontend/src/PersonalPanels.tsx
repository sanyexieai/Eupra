import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
  setNotice: (v: string) => void;
  error: (e: unknown) => void;
  config: any;
  t: (k: any) => string;
};
const useText = (app: AppContext) => (key: Key) =>
  (app.locale === "zh-CN" ? zh : en)[key];
type Credits = {
  remaining: number;
  daily_limit: number;
  successful_today: number;
  enabled: boolean;
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
  const [settings, setSettings] = useState<any>(null);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [sheet, setSheet] = useState<"account" | "help" | "about" | null>(null);
  useEffect(() => {
    let alive = true;
    setWorks(null);
    setSettings(null);
    setFailed(false);
    setSettingsFailed(false);
    if (app.user) {
      api("/me/works")
        .then((r) => {
          if (alive) setWorks(r.items);
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
      if (value.locale)
        app.setLocale(value.locale === "en" ? "en-US" : "zh-CN");
      app.setNotice(t("saved"));
    } catch {
      app.setNotice(t("saveError"));
    } finally {
      setBusy(false);
    }
  };
  const counts = works
    ? [
        new Set(works.map((v) => v.story_world_id)).size,
        works.filter((v) => !v.parent_version_id).length,
        works.length,
      ]
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
        <div className="pp-avatar">✦</div>
        <div>
          <small>{t("profile")}</small>
          <h1>{app.user?.email || t("guest")}</h1>
          <p>{t("profileBody")}</p>
        </div>
        {app.user ? (
          <button
            className="pp-light-button"
            onClick={() => setSheet("account")}
          >
            {t("account")}
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
          {sheet === "account" && <strong>{app.user?.email}</strong>}
          <p>{t((sheet + "Body") as Key)}</p>
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
  const [demo, setDemo] = useState(false);
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
        <Link className="pp-credit-pill" to="/balance">
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
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <small>{custom.length}/150</small>
            </div>
          )}
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
            src={src}
            controls
            playsInline
            preload="metadata"
            aria-label={t("demoTitle")}
          />
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
  const { data, failed, retry } = useCredits(app.user);
  const [sheet, setSheet] = useState<"policy" | "membership" | null>(null);
  return (
    <main className="pp-balance pp-dark">
      <div className="pp-topline">
        <Link className="pp-icon" to="/settings" aria-label={t("back")}>
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
            <span className="pp-status">{t("statusOff")}</span>
          </div>
          <p>{t("creditBody")}</p>
          <progress
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
          <button className="pp-link" onClick={() => setSheet("policy")}>
            {t("policy")}
            <ChevronRight size={16} />
          </button>
        </section>
      )}
      <Link className="pp-continue-card" to="/works">
        <div className="pp-continue-orb">
          <img src="/assets/orb-mark.svg" alt="" />
        </div>
        <div>
          <small>{t("private")}</small>
          <h2>{t("chooseWork")}</h2>
          <p>{t("unavailable")}</p>
          <span className="pp-gradient-button">
            {t("allWorks")}
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
