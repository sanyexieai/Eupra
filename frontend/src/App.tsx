import { DraftLibrary } from "./DraftLibrary";
import { ExportPanel, ShareUnavailable } from "./ExportPanel";
import {
  LineageGraph,
  ContributionCards,
  type AncestorReference,
} from "./LineageGraph";
import { CreationWorkbench, JobTheater } from "./CreationPanels";
import { ProfileSettings, VideoStudio, VideoBalance } from "./PersonalPanels";
import { VersionVisual, VersionStrip } from "./VersionExplorer";
import { downloadExamplePoster } from "./poster";
import {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import {
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
  useBlocker,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Globe,
  Plus,
  Image as ImageIcon,
  Camera,
  Type,
  Layers,
  Sparkles,
  Upload,
  X,
  RefreshCw,
  Bookmark,
  Share2,
  Video,
  FolderHeart,
  Settings,
  ShieldCheck,
  Check,
  LoaderCircle,
  GitBranch,
  LogOut,
  Flag,
  ChevronRight,
  Lock,
  Clock,
  Menu,
} from "lucide-react";
import zh from "./locales/zh-CN.json";
import en from "./locales/en-US.json";
import {
  api,
  post,
  ApiError,
  type Config,
  type Version,
  type Job,
} from "./api";
type Key = keyof typeof zh;
type Mode = "photo" | "text" | "mix";
type Draft = {
  mode: Mode;
  text: string;
  file: File | null;
  preview: string;
  sample: boolean;
  source_id?: string | null;
  parent_version_id?: string | null;
};
const Context = createContext<any>(null);
const useApp = () => useContext(Context);
const asset = (name: string) => "/assets/" + name;
function Btn({
  children,
  onClick,
  kind = "",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`btn ${kind} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Logo() {
  const { t } = useApp();
  return (
    <Link to="/" className="brand">
      <img src={asset("logo.png")} alt="" />
      <span>
        {t("brand")}
        <b>·</b>
      </span>
    </Link>
  );
}
export default function App() {
  const [locale, applyLocale] = useState(
    localStorage.getItem("eupra.locale") === "en-US" ? "en-US" : "zh-CN",
  );
  const [config, setConfig] = useState<Config | null>(null);
  const [user, setUser] = useState<any>(null);
  const [auth, setAuth] = useState(false);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    mode: "photo",
    text: sessionStorage.getItem("eupra.draft") || "",
    file: null,
    preview: "",
    sample: false,
  });
  const t = (k: Key) => (locale === "zh-CN" ? zh : en)[k] || k;
  const navigate = useNavigate();
  const location = useLocation();
  const localeChoice = useRef(0);
  const hydratedAccount = useRef<string | null>(null);
  const preserveRegistrationLocale = useRef(false);
  const setLocale = (next: string) => {
    const normalized = next === "en" || next === "en-US" ? "en-US" : "zh-CN";
    localeChoice.current++;
    applyLocale(normalized);
    if (user)
      api("/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ locale: normalized }),
      }).catch(() =>
        setNotice(
          normalized === "zh-CN"
            ? "语言已在本机切换，但账号偏好未保存。"
            : "Language changed locally, but the account preference was not saved.",
        ),
      );
  };
  useEffect(() => {
    if (!user) {
      hydratedAccount.current = null;
      return;
    }
    if (hydratedAccount.current === user.id) return;
    hydratedAccount.current = user.id;
    if (preserveRegistrationLocale.current) {
      preserveRegistrationLocale.current = false;
      return;
    }
    const choice = localeChoice.current;
    let active = true;
    api("/me/settings")
      .then((settings) => {
        if (
          active &&
          choice === localeChoice.current &&
          ["zh-CN", "en", "en-US"].includes(settings.locale)
        )
          applyLocale(settings.locale === "zh-CN" ? "zh-CN" : "en-US");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    api<Config>("/config")
      .then(setConfig)
      .catch(() => setOffline(true));
    api("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, []);
  useEffect(() => {
    localStorage.setItem("eupra.locale", locale);
    document.documentElement.lang = locale;
    document.title = t("brand") + " · " + t("welcome");
  }, [locale]);
  useEffect(() => {
    sessionStorage.setItem("eupra.draft", draft.text);
  }, [draft.text]);
  useEffect(() => {
    window.scrollTo(0, 0);
    setAuth(false);
  }, [location.pathname]);
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(id);
    }
  }, [notice]);
  const error = (e: any) => {
    if (
      e instanceof ApiError &&
      ["UNAUTHORIZED", "AUTH_REQUIRED"].includes(e.code)
    ) {
      setAuth(true);
      return;
    }
    const map: Record<string, Key> = {
      PROVIDER_UNAVAILABLE: "providerOff",
      VIDEO_UNAVAILABLE: "videoUnavailable",
      SAFETY_HOLD: "shareHold",
      REMIX_DISABLED: "remixDisabled",
      INVALID_CREDENTIALS: "authFailed",
      REVISION_CONFLICT: "draftConflict",
      SHARE_TOKEN_REQUIRED: "retryShared",
    };
    setNotice(t(map[e.code] || "error"));
  };
  return (
    <Context.Provider
      value={{
        locale,
        setLocale,
        applyLocale,
        preserveGuestLocale: async () => {
          preserveRegistrationLocale.current = true;
          try {
            await api("/me/settings", {
              method: "PATCH",
              body: JSON.stringify({ locale }),
            });
          } catch {
            setNotice(
              locale === "zh-CN"
                ? "账号已创建，但语言偏好未保存。"
                : "Account created, but the language preference was not saved.",
            );
          }
        },
        t,
        config,
        user,
        setUser,
        setAuth,
        setNotice,
        draft,
        setDraft,
        error,
        navigate,
      }}
    >
      <div
        className={
          "site " +
          (location.pathname === "/create"
            ? "creation-shell light-app-shell"
            : location.pathname === "/settings"
              ? "settings-shell light-app-shell"
              : location.pathname.startsWith("/jobs/") ||
                  location.pathname.startsWith("/share/")
                ? "light-app-shell"
                : location.pathname === "/welcome"
                  ? "welcome-shell"
                  : "")
        }
      >
        <Header />
        {offline && (
          <div className="service-banner">
            <ShieldCheck size={15} />
            {t("offline")}
          </div>
        )}
        {config?.demo && (
          <div className="service-banner demo">
            <Sparkles size={15} />
            {t("demoMode")}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/create" element={<Create />} />
          <Route path="/jobs/:id" element={<JobPage />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/versions/:id" element={<Result details />} />
          <Route path="/remix/:id" element={<Remix />} />
          <Route path="/share/:id" element={<SharePage />} />
          <Route path="/s/:token" element={<PublicShare />} />
          <Route path="/works" element={<Works />} />
          <Route path="/worlds/:id" element={<World />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/examples/:id" element={<Example />} />
          <Route path="*" element={<Unavailable />} />
        </Routes>
        {location.pathname === "/" && (
          <footer>
            <Logo />
            <span>{t("copyright")}</span>
            <Link to="/settings">{t("settings")}</Link>
          </footer>
        )}
        <MobileNav />
        {notice && (
          <div className="toast" role="status">
            <ShieldCheck size={18} />
            <span>{notice}</span>
            <button aria-label={t("close")} onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {auth && <AuthDialog />}
      </div>
    </Context.Provider>
  );
}
function Header() {
  const { t, locale, setLocale, user, setAuth } = useApp();
  const { pathname } = useLocation();
  const compact = pathname !== "/";
  return (
    <header>
      <div className="header-brand">
        <Logo />
        {pathname === "/create" && (
          <span className="header-context">{t("creationHome")}</span>
        )}
      </div>
      {!compact && (
        <nav>
          <a href="/#possibilities">{t("navExamples")}</a>
          <a href="/#how">{t("navHow")}</a>
          <Link to="/works">{t("navWorks")}</Link>
        </nav>
      )}
      <div className="header-actions">
        <button
          className="language"
          onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
          aria-label={t("language")}
        >
          <Globe size={17} />
          <span>{locale === "zh-CN" ? "中文" : "EN"}</span>
        </button>
        {pathname === "/settings" ? (
          <a
            className="account-button"
            aria-label={t("settings")}
            href="#personal-preferences"
          >
            <Settings size={19} />
          </a>
        ) : user ? (
          <Link
            className="account-button"
            aria-label={t("settings")}
            to="/settings"
          >
            <Settings size={19} />
          </Link>
        ) : (
          <button className="login-button" onClick={() => setAuth(true)}>
            {t("login")}
          </button>
        )}
        {!compact && (
          <Link className="btn white small" to="/create">
            {t("start")}
            <ArrowUpRight size={15} />
          </Link>
        )}
      </div>
    </header>
  );
}
function MobileNav() {
  const { t } = useApp();
  const loc = useLocation();
  if (!["/create", "/works", "/settings"].includes(loc.pathname)) return null;
  return (
    <div className="mobile-nav">
      <Link
        to="/create"
        aria-current={loc.pathname === "/create" ? "page" : undefined}
      >
        <Sparkles size={20} />
        {t("start")}
      </Link>
      <Link
        to="/works"
        aria-current={loc.pathname === "/works" ? "page" : undefined}
      >
        <FolderHeart size={20} />
        {t("navWorks")}
      </Link>
      <Link
        to="/settings"
        aria-current={loc.pathname === "/settings" ? "page" : undefined}
      >
        <Settings size={20} />
        {t("settings")}
      </Link>
    </div>
  );
}
function Landing() {
  const { t, locale } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoBase =
    locale === "zh-CN" ? "cn12_cinematic_demo_5s" : "cn12_cinematic_demo_5s_en";
  useEffect(() => setVideoFailed(false), [locale]);
  return (
    <>
      <main className="landing">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <Sparkles size={15} />
              {t("eyebrow")}
            </p>
            <h1>
              {t("headline1")}
              <br />
              <span>{t("headline2")}</span>
            </h1>
            <p className="hero-description">{t("heroDesc")}</p>
            <Workbench compact />
          </div>
          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="portal">
              <img src={asset("portal-gateway.jpg")} alt="" />
            </div>
            <Link to="/examples/ceo" className="floating-card ceo-card">
              <img src={asset("cat-ceo-hero.webp")} alt={t("ceo")} />
              <span>
                <i />
                {t("version1")} <ArrowUpRight size={14} />
              </span>
            </Link>
            <Link to="/examples/moon" className="floating-card moon-card">
              <img src={asset("cat-moon-hero.webp")} alt={t("moon")} />
              <span>
                {t("version2")}
                <ArrowUpRight size={14} />
              </span>
            </Link>
            <div className="story-pill">
              <Sparkles />
              <div>
                <strong>{t("onePhoto")}</strong>
                <small>{t("moreStory")}</small>
              </div>
            </div>
            <span className="star star-one">✦</span>
            <span className="star star-two">✧</span>
            <p className="art-disclaimer">{t("exampleNote")}</p>
          </div>
        </section>
        <div className="hero-baseline">
          <span>
            <i />
            {t("storyHeading")}
          </span>
          <a href="#possibilities">{t("next")} ↓</a>
        </div>
        <section id="possibilities" className="section">
          <p className="eyebrow">
            <GitBranch size={16} />
            {t("welcome")}
          </p>
          <h2>{t("storyHeading")}</h2>
          <p className="section-desc">{t("storySubtitle")}</p>
          <div className="story-grid">
            {[
              ["demo-source.webp", "original", "source", "ceo"],
              ["cat-ceo-hero.webp", "version1", "ceo", "ceo"],
              ["cat-moon-hero.webp", "version2", "moon", "moon"],
            ].map(([img, label, title, id], i) => (
              <Link className="story-card" to={"/examples/" + id} key={img}>
                <img src={asset(img)} alt={t(title)} />
                <div className="card-top">
                  <span>
                    0{i + 1} / {t(label)}
                  </span>
                  <ArrowUpRight size={19} />
                </div>
                <div className="card-bottom">
                  <small>{t("example")}</small>
                  <h3>{t(title)}</h3>
                </div>
              </Link>
            ))}
          </div>
          <p className="fineprint">{t("exampleNote")}</p>
        </section>
        <section id="how" className="landing-how">
          <div className="landing-section-inner">
            <div className="landing-how-heading">
              <div>
                <p className="eyebrow">{t("howKicker")}</p>
                <h2>{t("howHeading")}</h2>
              </div>
              <img src={asset("logo.png")} alt="" />
            </div>
            <div className="illustrated-steps">
              {[1, 2, 3].map((i) => (
                <article key={i}>
                  <div className="step-mark">
                    <span>0{i}</span>
                    <ArrowUpRight size={14} />
                  </div>
                  <div className={"step-illustration illustration-" + i}>
                    <img
                      src={asset(
                        [
                          "demo-source.webp",
                          "cat-ceo-hero.webp",
                          "cat-moon-hero.webp",
                        ][i - 1],
                      )}
                      alt=""
                    />
                    {i === 3 ? (
                      <img src={asset("shiba-agent.webp")} alt="" />
                    ) : (
                      <span aria-hidden="true">✦</span>
                    )}
                  </div>
                  <h3>{t("step" + i)}</h3>
                  <p>{t("step" + i + "body")}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="landing-relay" aria-labelledby="relay-title">
          <div className="landing-section-inner relay-layout">
            <div className="relay-copy">
              <p className="eyebrow">{t("relayKicker")}</p>
              <h2 id="relay-title">{t("relayTitle")}</h2>
              <p>{t("relayBody")}</p>
              <p className="relay-proof">{t("relayLineage")}</p>
              <Link className="btn white" to="/examples/moon">
                {t("relayAction")}
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="relay-artwork">
              <Link to="/examples/ceo" className="relay-parent">
                <img src={asset("cat-ceo-hero.webp")} alt={t("ceo")} />
                <span>{t("version1")}</span>
              </Link>
              <span className="relay-connector" aria-hidden="true">
                ↝
              </span>
              <Link to="/examples/moon" className="relay-child">
                <img src={asset("cat-moon-hero.webp")} alt={t("moon")} />
                <span>{t("version2")}</span>
              </Link>
              <p className="relay-scenario">❞ {t("relayScenario")}</p>
            </div>
          </div>
          <p className="fineprint">{t("exampleNote")}</p>
        </section>
        <section
          className="landing-video"
          aria-labelledby="landing-video-title"
        >
          <div className="landing-section-inner video-layout">
            <div className="landing-video-frame">
              <video
                ref={video}
                key={locale}
                controls
                playsInline
                preload="metadata"
                poster={asset("cat-ceo-hero.webp")}
                aria-label={t("landingVideoLabel")}
                onError={() => setVideoFailed(true)}
                onPlaying={() => setVideoFailed(false)}
              >
                <source src={asset(videoBase + ".webm")} type="video/webm" />
                <source src={asset(videoBase + ".mp4")} type="video/mp4" />
              </video>
              <span>{t("example")}</span>
            </div>
            <div>
              <p className="eyebrow">{t("landingVideoKicker")}</p>
              <h2 id="landing-video-title">{t("landingVideoTitle")}</h2>
              <p>{t("landingVideoBody")}</p>
              <p className="video-demo-boundary">{t("landingVideoNote")}</p>
              <button
                className="btn primary"
                onClick={() => {
                  video.current?.scrollIntoView({
                    block: "center",
                    behavior: "smooth",
                  });
                  video.current?.play().catch(() => setVideoFailed(true));
                }}
              >
                {t("landingVideoPlay")}
                <ArrowUpRight size={18} />
              </button>
              {videoFailed && <p role="alert">{t("landingVideoError")}</p>}
              <a
                className="text-button"
                href={asset(videoBase + ".mp4")}
                download
              >
                {t("landingVideoDownload")}
              </a>
              <Link className="text-button" to="/balance">
                {t("credits")}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
        <section className="landing-closing">
          <div className="closing-frame">
            <p className="eyebrow">{t("closingKicker")}</p>
            <h2>{t("closing")}</h2>
            <Link to="/create" className="btn primary">
              {t("happen")}
              <ArrowRight size={19} />
            </Link>
            <span className="closing-star first" aria-hidden="true">
              ✦
            </span>
            <span className="closing-star second" aria-hidden="true">
              ✧
            </span>
            <span className="closing-star third" aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
      </main>
    </>
  );
}
function Workbench({ compact = false }: { compact?: boolean }) {
  const {
    t,
    draft,
    setDraft,
    config,
    user,
    setAuth,
    error,
    navigate,
    setNotice,
    locale,
  } = useApp();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const file = (f: File) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.size > (config?.upload?.max_bytes || 10485760)
    ) {
      setNotice(t("invalidFile"));
      return;
    }
    setDraft({
      ...draft,
      file: f,
      preview: URL.createObjectURL(f),
      sample: false,
    });
  };
  const sample = async () => {
    try {
      const blob = await fetch(asset("demo-source.webp")).then((r) => r.blob());
      setDraft({
        ...draft,
        file: new File([blob], "example-cat.webp", { type: "image/webp" }),
        preview: asset("demo-source.webp"),
        sample: true,
      });
    } catch (e) {
      error(e);
    }
  };
  const submit = async () => {
    if (busy) return;
    if (!config?.generation_enabled) {
      setNotice(t("providerOff"));
      return;
    }
    if (!user) {
      setAuth(true);
      return;
    }
    if (
      (draft.mode === "photo" && !draft.file) ||
      (draft.mode === "text" && !draft.text.trim()) ||
      (draft.mode === "mix" && !draft.file && !draft.text.trim())
    ) {
      setNotice(t("needInput"));
      return;
    }
    setBusy(true);
    try {
      let source_id;
      if (draft.file && draft.mode !== "text") {
        const form = new FormData();
        form.append("file", draft.file);
        source_id = (await api("/uploads", { method: "POST", body: form })).id;
      }
      const j = await api<Job>("/generation-jobs", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          kind: "first_twist",
          text: draft.mode === "photo" ? undefined : draft.text,
          source_id,
          locale: locale === "zh-CN" ? "zh-CN" : "en",
        }),
      });
      sessionStorage.setItem("eupra.job", j.id);
      navigate("/jobs/" + j.id);
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`workbench ${compact ? "compact" : ""}`} id="create">
      <div className="workbench-title">
        <i />
        {t("createTitle")}
      </div>
      <div className="tabs">
        {(["photo", "text", "mix"] as Mode[]).map((m, i) => (
          <button
            key={m}
            className={draft.mode === m ? "active" : ""}
            onClick={() => setDraft({ ...draft, mode: m })}
          >
            {!compact &&
              [
                <ImageIcon size={17} />,
                <Type size={17} />,
                <Layers size={17} />,
              ][i]}
            {t(m)}
          </button>
        ))}
      </div>
      {draft.mode !== "text" && (
        <div
          className={`dropzone ${drag ? "drag" : ""} ${draft.preview ? "has-image" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files[0]) file(e.dataTransfer.files[0]);
          }}
        >
          {draft.preview ? (
            <>
              <img src={draft.preview} alt={t("photo")} />
              <button
                className="remove-image"
                aria-label={t("remove")}
                onClick={() =>
                  setDraft({ ...draft, file: null, preview: "", sample: false })
                }
              >
                <X size={18} />
              </button>
              <span className="image-caption">
                {draft.sample ? t("example") : t("sourcePrivate")}
              </span>
            </>
          ) : (
            <button
              className="drop-target"
              onClick={() => fileInput.current?.click()}
            >
              <div className="upload-icon">
                <ArrowUpRight />
              </div>
              <div>
                <strong>{t("upload")}</strong>
                <small>{t("uploadHint")}</small>
                <em>{t("uploadLimit")}</em>
              </div>
              <Plus className="drop-plus" size={22} />
            </button>
          )}
        </div>
      )}
      <input
        aria-label={t("choose")}
        hidden
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          if (e.target.files?.[0]) file(e.target.files[0]);
        }}
      />
      {draft.mode !== "photo" && (
        <div className="text-input">
          <textarea
            aria-label={t("text")}
            maxLength={420}
            placeholder={t("placeholder")}
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          />
          <span>{draft.text.length}/420</span>
        </div>
      )}
      <div className="workbench-actions">
        <button className="sample-button" onClick={sample}>
          <img src={asset("demo-source.webp")} alt="" />
          {t("tryCat")}
          <ArrowUpRight size={13} />
        </button>
        <Btn kind="primary" onClick={submit} disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Sparkles size={16} />
          )}{" "}
          {t(busy ? "working" : "happen")}
          <ArrowUpRight size={17} />
        </Btn>
      </div>
      <p className="fineprint">{t("free")}</p>
      {!compact && config && !config.generation_enabled && (
        <p className="inline-note">
          <ShieldCheck size={17} />
          {t("providerOff")}
        </p>
      )}
    </div>
  );
}
function Create() {
  const app = useApp();
  const [params] = useSearchParams();
  const { t } = app;
  const job = sessionStorage.getItem("eupra.job");
  return (
    <main className="create-page">
      <div className="create-intro">
        <p className="eyebrow">
          <Sparkles size={16} />
          {t("welcome")}
        </p>
        <h1>
          {app.locale === "zh-CN" ? (
            <>
              现在，想<span className="creation-title-accent">发生</span>
              点什么？
            </>
          ) : (
            t("createTitle")
          )}
        </h1>
        <p>{t("createSubtitle")}</p>
      </div>
      <CreationWorkbench app={app} draftId={params.get("draft") || undefined} />
      {job && (
        <Link className="resume" to={"/jobs/" + job}>
          <Clock size={16} />
          {t("continueJob")}
          <ArrowRight size={16} />
        </Link>
      )}
    </main>
  );
}
function AuthDialog() {
  const { t, setAuth, setUser, setNotice, preserveGuestLocale } = useApp();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAuth(false);
      if (e.key === "Tab") {
        const els = modalRef.current?.querySelectorAll<HTMLElement>(
          "button,input,a[href]",
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
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  const submit = async (e: any) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (register && password.length < 10) {
      setErr(t("passwordShort"));
      return;
    }
    setBusy(true);
    try {
      const r = await post("/auth/" + (register ? "register" : "login"), {
        email,
        password,
      });
      if (register) await preserveGuestLocale();
      setUser(r.user);
      setAuth(false);
    } catch {
      setErr(t("authFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={() => setAuth(false)}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label={t("close")}
          onClick={() => setAuth(false)}
        >
          <X />
        </button>
        <img className="modal-logo" src={asset("orb-mark.svg")} alt="" />
        <h2 id="auth-title">{t(register ? "register" : "login")}</h2>
        <p>{t("authNote")}</p>
        <form onSubmit={submit}>
          <label>
            {t("email")}
            <input
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            {t("password")}
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {err && (
            <p className="form-error" role="alert">
              {err}
            </p>
          )}
          <Btn type="submit" kind="primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : null}
            {t(register ? "register" : "login")}
            <ArrowRight size={18} />
          </Btn>
        </form>
        <button className="text-button" onClick={() => setRegister(!register)}>
          {t(register ? "login" : "register")}
        </button>
      </div>
    </div>
  );
}
function PageTitle({
  title,
  desc,
  eyebrow,
}: {
  title: Key;
  desc?: Key;
  eyebrow?: Key;
}) {
  const { t } = useApp();
  return (
    <div className="page-title">
      {eyebrow && (
        <p className="eyebrow">
          <Sparkles size={16} />
          {t(eyebrow)}
        </p>
      )}
      <h1>{t(title)}</h1>
      {desc && <p>{t(desc)}</p>}
    </div>
  );
}
function useVersion() {
  const { id } = useParams();
  const [v, setV] = useState<Version | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setV(null);
    setErr(false);
    api<Version>("/versions/" + id)
      .then(setV)
      .catch(() => setErr(true));
  }, [id]);
  return { v, setV, err };
}
function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={28} />
    </div>
  );
}
function Missing() {
  const { t } = useApp();
  return (
    <main className="page narrow">
      <div className="empty">
        <Lock />
        <h2>{t("notFound")}</h2>
        <Link className="btn primary" to="/works">
          {t("navWorks")}
        </Link>
      </div>
    </main>
  );
}
function JobPage() {
  const { id } = useParams();
  const { t, navigate, error, locale } = useApp();
  const [job, setJob] = useState<Job | null>(null);
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pollEpoch, setPollEpoch] = useState(0);
  const activeJob = !!job && ["queued", "running"].includes(job.status);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      activeJob && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm(t("leaveJobConfirm"))) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, locale]);
  useEffect(() => {
    if (!activeJob) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [activeJob]);
  useEffect(() => {
    let active = true;
    let terminal = false;
    setJob(null);
    setFailed(false);
    const poll = async () => {
      if (terminal) return;
      try {
        const j = await api<Job>("/generation-jobs/" + id);
        if (!active) return;
        setJob(j);
        setFailed(false);
        terminal = ["succeeded", "failed", "cancelled"].includes(j.status);
        if (j.status === "succeeded" && j.version_id) {
          sessionStorage.removeItem("eupra.job");
        }
      } catch {
        if (active) setFailed(true);
      }
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, pollEpoch]);
  return (
    <main className="page narrow job-page">
      <JobTheater
        locale={locale}
        job={job}
        failed={failed}
        sourcePreview={job?.input_summary?.source_url || ""}
        sourceText={job?.input_summary?.text_excerpt || ""}
      >
        <div className="status-pill">
          {!job || ["queued", "running"].includes(job.status) ? <i /> : null}
          {job
            ? t(
                (
                  {
                    REQUEST_INTAKE: "queued",
                    DEMO_TEMPLATE_PREPARATION: "stageDemo",
                    INPUT_SAFETY: "stageInputSafety",
                    REALITY_PARSER: "stageUnderstand",
                    POSSIBILITY_MINER: "stagePossibilities",
                    SEED_FACTORY: "stageConcepts",
                    DIVERSITY_FILTER: "stageDiversity",
                    TASTE_JUDGE: "stageRank",
                    CANDIDATE_EXPANDER: "stageExpand",
                    PAIRWISE_TOURNAMENT: "stageSelect",
                    VISUAL_DIRECTOR: "stageVisual",
                    MEDIA_GENERATION: "stageMedia",
                    FINAL_JUDGE: "stageFinal",
                    OUTPUT_SAFETY: "stageOutputSafety",
                    PROVIDER_PIPELINE: "providerStage",
                    DEMO_DRAFT: "succeeded",
                    DRAFT: "succeeded",
                    FAILED: "failed",
                    CANCELLED: "cancelled",
                    interrupted: "failed",
                  } as Record<string, Key>
                )[job.stage] ||
                  ([
                    "queued",
                    "running",
                    "succeeded",
                    "failed",
                    "cancelled",
                  ].includes(job.status)
                    ? job.status
                    : "running"),
              )
            : t(failed ? "offline" : "working")}
        </div>
        {job?.demo && <p className="inline-note">{t("demoMode")}</p>}
        {job?.status === "succeeded" && job.version_id && (
          <Btn
            kind="primary"
            onClick={() =>
              navigate("/result/" + job.version_id, { replace: true })
            }
          >
            {t("revealVersion")}
          </Btn>
        )}
        {job?.status === "failed" && job.error?.code.includes("TIMEOUT") && (
          <p role="alert">{t("timeoutRecovery")}</p>
        )}
        {failed && (
          <Btn onClick={() => setPollEpoch((v) => v + 1)}>
            {t("refreshJobStatus")}
          </Btn>
        )}
        {job?.error && (
          <p className="inline-note">
            {t("error")} ({job.error.code})
          </p>
        )}
        {job && ["queued", "running"].includes(job.status) && (
          <Btn
            disabled={cancelling}
            onClick={async () => {
              if (cancelling || !window.confirm(t("cancelConfirm"))) return;
              setCancelling(true);
              try {
                setJob(await post("/generation-jobs/" + id + "/cancel"));
              } catch (e) {
                error(e);
              } finally {
                setCancelling(false);
              }
            }}
          >
            {t("cancelJob")}
          </Btn>
        )}
        {job && ["failed", "cancelled"].includes(job.status) && (
          <Btn
            kind="primary"
            disabled={retrying}
            onClick={async () => {
              if (retrying) return;
              setRetrying(true);
              try {
                const next = await api<Job>(
                  "/generation-jobs/" + job.id + "/retry",
                  {
                    method: "POST",
                    headers: { "Idempotency-Key": crypto.randomUUID() },
                    body: JSON.stringify({}),
                  },
                );
                sessionStorage.setItem("eupra.job", next.id);
                setJob(null);
                navigate("/jobs/" + next.id);
              } catch (e) {
                error(e);
              } finally {
                setRetrying(false);
              }
            }}
          >
            {t("retryOriginal")}
          </Btn>
        )}
        {(failed || (job && ["failed", "cancelled"].includes(job.status))) && (
          <Link className="btn primary" to="/create">
            {t("start")}
            <ArrowRight size={18} />
          </Link>
        )}
      </JobTheater>
    </main>
  );
}
function Result({ details = false }: { details?: boolean }) {
  const { v, setV, err } = useVersion();
  const { t, error, setNotice, config, user, setAuth, locale, navigate } =
    useApp();
  const [showSource, setShowSource] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [branches, setBranches] = useState<Version[] | null>(null);
  const [branchesFailed, setBranchesFailed] = useState(false);
  useEffect(() => {
    setBranches(null);
    setBranchesFailed(false);
    if (!branchesOpen || !v) return;
    let active = true;
    api("/versions/" + v.id + "/children")
      .then((r) => {
        if (active) setBranches(r.items);
      })
      .catch(() => {
        if (active) setBranchesFailed(true);
      });
    return () => {
      active = false;
    };
  }, [v?.id, branchesOpen]);
  if (err) return <Missing />;
  if (!v) return <Loading />;
  return (
    <main className="page result-page">
      <div className="result-top">
        <Link to="/works" className="back">
          <ArrowLeft size={17} />
          {t("navWorks")}
        </Link>
        <span className="eyebrow">
          <Sparkles size={14} />
          {t(v.demo ? "textDemo" : "current")}
        </span>
      </div>
      <div className="result-layout">
        <div className={"result-art " + (!v.image_url ? "concept-art" : "")}>
          {v.image_url ? (
            <img src={v.image_url} alt={v.title} />
          ) : (
            <div className="concept-visual">
              <img src={asset("orb-mark.svg")} alt="" />
              <div className="concept-orbit" />
              <p>{t(v.demo ? "noImage" : "noImageNonDemo")}</p>
            </div>
          )}
          <div className="result-tags">
            <span>{t(v.demo ? "demo" : "aiLabel")}</span>
            <span>
              {t(
                v.safety_state === "APPROVED"
                  ? "approved"
                  : v.safety_state === "HOLD"
                    ? "hold"
                    : "notApproved",
              )}
            </span>
          </div>
          <div className="result-art-title">
            <small>
              {t("current")} · {v.depth + 1}
            </small>
            <h1>{v.title}</h1>
          </div>
        </div>
        <div className="result-info">
          <p className="eyebrow">
            <Sparkles size={17} />
            {t("welcome")}
          </p>
          <p className="caption">{v.caption}</p>
          {v.source_id && (
            <>
              <button
                className="text-button"
                onClick={() => setShowSource(!showSource)}
              >
                <ImageIcon size={15} />
                {t("sourcePrivate")}
              </button>
              {showSource && (
                <img
                  className="private-source"
                  src={"/api/v1/uploads/" + v.source_id}
                  alt={t("sourcePrivate")}
                />
              )}
            </>
          )}
          <Btn
            kind="primary wide"
            disabled={continuing || !v.remix_allowed}
            onClick={async () => {
              if (continuing) return;
              if (!config?.generation_enabled) {
                setNotice(t("providerOff"));
                return;
              }
              if (!user) {
                setAuth(true);
                return;
              }
              setContinuing(true);
              try {
                const next = await api<Job>("/generation-jobs", {
                  method: "POST",
                  headers: { "Idempotency-Key": crypto.randomUUID() },
                  body: JSON.stringify({
                    kind: "continuation",
                    parent_version_id: v.id,
                    locale: locale === "zh-CN" ? "zh-CN" : "en",
                  }),
                });
                sessionStorage.setItem("eupra.job", next.id);
                navigate("/jobs/" + next.id);
              } catch (e) {
                error(e);
              } finally {
                setContinuing(false);
              }
            }}
          >
            <RefreshCw size={19} />
            {t("push")}
            <ArrowRight size={20} />
          </Btn>
          <Link
            className="text-button"
            to={"/remix/" + v.id + "?version=" + encodeURIComponent(v.id)}
          >
            {t("chooseDirection")}
            <ArrowUpRight size={16} />
          </Link>
          <Btn onClick={() => setBranchesOpen((x) => !x)}>
            {t("browseBranches")}
          </Btn>
          {branchesOpen && (
            <section
              className="inline-branches"
              aria-label={t("browseBranches")}
            >
              {branchesFailed ? (
                <p role="alert">{t("offline")}</p>
              ) : branches === null ? (
                <p>{t("working")}</p>
              ) : branches.length ? (
                <VersionStrip
                  t={t}
                  items={branches}
                  selected=""
                  onSelect={(id) => navigate("/result/" + id)}
                />
              ) : (
                <p>{t("noBranches")}</p>
              )}
            </section>
          )}
          <div className="result-actions">
            <Btn
              onClick={async () => {
                try {
                  await post("/versions/" + v.id + "/save");
                  setNotice(t("saved"));
                } catch (e) {
                  error(e);
                }
              }}
            >
              <Bookmark size={20} />
              {t("save")}
            </Btn>
            <Link className="btn" to={"/share/" + v.id}>
              <Share2 size={20} />
              {t("share")}
            </Link>
            <Link className="btn" to={"/video/" + v.id}>
              <Video size={20} />
              {t("video")}
            </Link>
          </div>
          <Link
            className="lineage-link"
            to={
              "/worlds/" +
              v.story_world_id +
              "?version=" +
              encodeURIComponent(v.id)
            }
          >
            <GitBranch size={22} />
            <div>
              <strong>{t("world")}</strong>
              <small>{t("viewWorld")}</small>
            </div>
            <ChevronRight size={20} />
          </Link>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            {t("privacy")}
          </div>
          {details && (
            <>
              <VersionLineage v={v} />
              <div className="lineage-details">
                <h3>{t("lineage")}</h3>
                {[
                  ["root", v.root_version_id],
                  ["parent", v.parent_version_id || "—"],
                  ["creator", v.creator_id],
                ].map(([k, val]) => (
                  <div key={k}>
                    <span>{t(k)}</span>
                    <code>{val}</code>
                  </div>
                ))}
              </div>
            </>
          )}
          <button
            className="text-button"
            onClick={async () => {
              try {
                setV(
                  await api("/versions/" + v.id + "/remix-permission", {
                    method: "PATCH",
                    body: JSON.stringify({ remix_allowed: !v.remix_allowed }),
                  }),
                );
              } catch (e) {
                error(e);
              }
            }}
          >
            {v.remix_allowed ? <Check size={15} /> : <Lock size={15} />}{" "}
            {t("allowRemix")}
          </button>
          <button
            className="text-button"
            onClick={async () => {
              const reason = window.prompt(t("reportReason"));
              if (reason)
                try {
                  await post("/reports", { version_id: v.id, reason });
                  setNotice(t("reportSent"));
                } catch (e) {
                  error(e);
                }
            }}
          >
            <Flag size={14} />
            {t("report")}
          </button>
        </div>
      </div>
    </main>
  );
}
function SharePage() {
  const app = useApp();
  const { v, err } = useVersion();
  if (err) return <Missing />;
  if (!v) return <Loading />;
  return <ExportPanel app={app} version={v} />;
}
function PublicShare() {
  const { token } = useParams();
  const { t, user, setAuth, locale, navigate, error } = useApp();
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setData(null);
    setFailed(false);
    setErrorCode(undefined);
    let active = true;
    api("/share/" + token)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) {
          setFailed(true);
          setErrorCode(e?.code);
        }
      });
    return () => {
      active = false;
    };
  }, [token, retry]);
  if (failed)
    return (
      <ShareUnavailable
        locale={locale}
        errorCode={errorCode}
        onRetry={() => setRetry((v) => v + 1)}
      />
    );
  if (!data) return <Loading />;
  const v = data.version || data;
  return (
    <main className="page narrow public-share">
      <p className="eyebrow">
        <GitBranch size={17} />
        {t("localPreview")}
      </p>
      <VersionVisual t={t} v={v} large />
      <section className="public-participation">
        <p className="inline-note">{t("localPreviewNote")}</p>
        <Btn
          kind="primary wide"
          disabled={busy || !v.remix_allowed}
          onClick={async () => {
            if (!user) {
              setAuth(true);
              return;
            }
            if (busy) return;
            setBusy(true);
            try {
              const j = await api<Job>("/generation-jobs", {
                method: "POST",
                headers: { "Idempotency-Key": crypto.randomUUID() },
                body: JSON.stringify({
                  kind: "continuation",
                  parent_version_id: v.id,
                  share_token: token,
                  locale: locale === "zh-CN" ? "zh-CN" : "en",
                }),
              });
              sessionStorage.setItem("eupra.job", j.id);
              navigate("/jobs/" + j.id);
            } catch (e) {
              error(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sparkles size={19} />
          {t("push")}
          <ArrowRight size={20} />
        </Btn>
        <p className="fineprint">
          {t(
            !v.remix_allowed
              ? "remixDisabled"
              : user
                ? "accurateParent"
                : "authNeeded",
          )}
        </p>
      </section>
    </main>
  );
}
function SettingsPage() {
  const app = useApp();
  return <ProfileSettings app={app} />;
}
function VideoPage() {
  const app = useApp();
  const { v, err } = useVersion();
  if (err) return <Missing />;
  if (!v) return <Loading />;
  return <VideoStudio app={app} version={v} />;
}
function Balance() {
  const app = useApp();
  return <VideoBalance app={app} />;
}
function Example() {
  const { id } = useParams();
  const { t, setNotice } = useApp();
  const moon = id === "moon";
  return (
    <main className="page example-page">
      <div className="result-top">
        <Link to="/" className="back">
          <ArrowLeft size={16} />
          {t("back")}
        </Link>
        <span className="eyebrow">{t("exampleNote")}</span>
      </div>
      <div className="result-layout">
        <div className="result-art">
          <img
            src={asset(moon ? "cat-moon-hero.webp" : "cat-ceo-hero.webp")}
            alt={t(moon ? "moon" : "ceo")}
          />
          <div className="result-tags">
            <span>{t("aiExample")}</span>
          </div>
          <div className="result-art-title">
            <small>{t(moon ? "version2" : "version1")}</small>
            <h1>{t(moon ? "moon" : "ceo")}</h1>
          </div>
        </div>
        <div className="result-info">
          <p className="eyebrow">
            <Sparkles size={17} />
            {t("example")}
          </p>
          <h2>{t(moon ? "moon" : "ceo")}</h2>
          <p className="caption">{t(moon ? "moonCaption" : "ceoCaption")}</p>
          <Link
            className="btn primary wide"
            to={"/examples/" + (moon ? "ceo" : "moon")}
          >
            <RefreshCw size={19} />
            {t("push")}
            <ArrowRight size={19} />
          </Link>
          <p className="fineprint">{t("exampleNote")}</p>
          <Link className="btn wide" to="/create">
            {t("start")}
            <ArrowUpRight size={18} />
          </Link>
          <Btn
            className="wide"
            onClick={async () => {
              try {
                await downloadExamplePoster(moon, t);
                setNotice(t("posterReady"));
              } catch {
                setNotice(t("posterError"));
              }
            }}
          >
            <Upload size={18} />
            {t("exportExample")}
          </Btn>
          <p className="fineprint">{t("exportExampleNote")}</p>
          <div className="example-source">
            <img src={asset("demo-source.webp")} alt={t("original")} />
            <div>
              <small>{t("original")}</small>
              <p>{t("onePhoto")}</p>
            </div>
            <GitBranch size={24} />
          </div>
        </div>
      </div>
    </main>
  );
}
function Unavailable() {
  return (
    <main className="page narrow">
      <PageTitle title="unavailablePage" desc="communityOff" />
      <Link className="btn primary" to="/create">
        <Sparkles size={18} />
        <Translated k="start" />
      </Link>
    </main>
  );
}
function Translated({ k }: { k: Key }) {
  return useApp().t(k);
}

function Welcome() {
  const { t, draft, setDraft, navigate, config, setNotice } = useApp();
  const photo = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const choose = (file?: File) => {
    if (!file) return;
    const allowed = config?.upload?.mime_types || [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (
      !allowed.includes(file.type) ||
      file.size > (config?.upload?.max_bytes || 10485760)
    ) {
      setNotice(t("welcomeInvalidPhoto"));
      return;
    }
    if (draft.preview.startsWith("blob:")) URL.revokeObjectURL(draft.preview);
    setDraft({
      ...draft,
      mode: "photo",
      file,
      source_id: null,
      parent_version_id: null,
      preview: URL.createObjectURL(file),
      sample: false,
    });
    navigate("/create");
  };
  return (
    <main className="welcome-page">
      <input
        ref={photo}
        hidden
        type="file"
        accept={(
          config?.upload?.mime_types || [
            "image/jpeg",
            "image/png",
            "image/webp",
          ]
        ).join(",")}
        aria-label={t("welcomePhotoInput")}
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={t("welcomeCameraInput")}
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <p className="eyebrow">{t("welcomeKicker")}</p>
      <h1>{t("brand")}</h1>
      <span className="welcome-wordmark">EUPRA</span>
      <p className="welcome-slogan">{t("welcomeSlogan")}</p>
      <img
        className="welcome-portal"
        src={asset("portal-world.svg")}
        alt={t("welcome")}
      />
      <div className="welcome-bottom">
        <Link to="/create" className="btn welcome-cta">
          {t("createTitle")}
          <ArrowRight />
        </Link>
        <div className="quick-actions">
          {(["photo", "text", "mix"] as Mode[]).map((mode, i) => (
            <button
              key={mode}
              onClick={() => {
                if (mode === "photo") {
                  photo.current?.click();
                  return;
                }
                if (mode === "mix") {
                  camera.current?.click();
                  return;
                }
                setDraft({ ...draft, mode });
                navigate("/create");
              }}
            >
              {[<ImageIcon />, <Type />, <Camera />][i]}
              <span>{t(["quickPhoto", "quickText", "quickCamera"][i])}</span>
            </button>
          ))}
        </div>
        <p className="fineprint">{t("welcomeHint")}</p>
      </div>
    </main>
  );
}
function Works() {
  const app = useApp();
  const { t, user, setAuth, error } = app;
  const [refresh, setRefresh] = useState(0);
  const [works, setWorks] = useState<Version[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const savedParams = new URLSearchParams(
    sessionStorage.getItem("eupra.works.filters") || "",
  );
  const query = params.get("q") ?? savedParams.get("q") ?? "";
  const rawFilter = params.get("filter") ?? savedParams.get("filter") ?? "all";
  const filter = ["all", "originals", "remixes", "favorites"].includes(
    rawFilter,
  )
    ? rawFilter
    : "all";
  const sort =
    (params.get("sort") ?? savedParams.get("sort")) === "oldest"
      ? "oldest"
      : "newest";
  const changeFilters = (key: string, value: string) => {
    const next = new URLSearchParams({ q: query, filter, sort });
    next.set(key, value);
    sessionStorage.setItem("eupra.works.filters", next.toString());
    setParams(next, { replace: true });
  };
  const setQuery = (value: string) => changeFilters("q", value);
  const setFilter = (value: string) => changeFilters("filter", value);
  const setSort = (value: string) => changeFilters("sort", value);
  const [worlds, setWorlds] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (user)
      api("/me/story-worlds")
        .then((r) => setWorlds(r.items || []))
        .catch(() => setWorlds([]));
  }, [user, refresh]);
  useEffect(() => {
    if (user)
      api("/me/works")
        .then((r) => setWorks(r.items))
        .catch(() => setFailed(true));
  }, [user, refresh]);
  const all = works || [];
  const roots = all.filter((v) => !v.parent_version_id);
  const filtered = all
    .filter(
      (v) =>
        (
          v.title +
          " " +
          v.caption +
          " " +
          (worlds.find((w) => w.id === v.story_world_id)?.title || "")
        )
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" ||
          (filter === "originals" && !v.parent_version_id) ||
          (filter === "remixes" && !!v.parent_version_id) ||
          (filter === "favorites" && v.favorite)),
    )
    .sort((a, b) => {
      const time = (v: Version) =>
        typeof v.created_at === "number"
          ? v.created_at * 1000
          : new Date(v.created_at).getTime();
      return (time(b) - time(a)) * (sort === "newest" ? 1 : -1);
    });
  const featured = all[0];
  return (
    <main className="page">
      <PageTitle title="yourUniverse" desc="mySubtitle" eyebrow="navWorks" />
      <DraftLibrary app={app} onWorksChanged={() => setRefresh((v) => v + 1)} />
      {!user ? (
        <div className="empty">
          <FolderHeart />
          <h2>{t("authNeeded")}</h2>
          <Btn kind="primary" onClick={() => setAuth(true)}>
            {t("login")}
            <ArrowRight size={18} />
          </Btn>
        </div>
      ) : !works && !failed ? (
        <Loading />
      ) : !all.length ? (
        <div className="empty">
          <Sparkles />
          <h2>{t(failed ? "offline" : "empty")}</h2>
          <p>{t("emptyBody")}</p>
          <Link className="btn primary" to="/create">
            {t("happen")}
            <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          <div className="library-stats">
            {[
              [all.length, "allWorks"],
              [roots.length, "originalCount"],
              [all.length - roots.length, "remixCount"],
            ].map(([n, label]) => (
              <div key={label}>
                <strong>{String(n).padStart(2, "0")}</strong>
                <span>{t(label)}</span>
              </div>
            ))}
          </div>
          <Link
            className="world-feature"
            to={"/worlds/" + featured.story_world_id}
          >
            <VersionVisual t={t} v={featured} large />
            <span className="world-feature-badge">
              <GitBranch size={15} />
              {t("growingWorld")}
            </span>
            <span className="btn primary small world-feature-cta">
              {t("continueStory")}
              <ArrowUpRight size={16} />
            </span>
          </Link>
          <div className="source-meaning">
            <GitBranch />
            <div>
              <strong>{t("rootKept")}</strong>
              <small>{t("accurateParent")}</small>
            </div>
          </div>
          <div className="library-heading">
            <h2>{t("yourVersions")}</h2>
            <select
              aria-label={t("sort")}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">{t("newest")}</option>
              <option value="oldest">{t("oldest")}</option>
            </select>
          </div>
          <input
            className="library-search"
            type="search"
            aria-label={t("searchWorks")}
            placeholder={t("searchWorks")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-tabs">
            {["all", "originals", "remixes", "favorites"].map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {t(f)}
              </button>
            ))}
          </div>
          {filtered.length ? (
            <div className="works-grid">
              {filtered.map((v) => (
                <article className="work-card" key={v.id}>
                  <Link to={"/versions/" + v.id} className="work-image">
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.title} />
                    ) : (
                      <img
                        className="work-orb"
                        src={asset("orb-mark.svg")}
                        alt=""
                      />
                    )}
                    <span>{t(v.demo ? "textDemo" : "current")}</span>
                  </Link>
                  <div>
                    <div className="work-meta">
                      <small>
                        {new Date(
                          typeof v.created_at === "number"
                            ? v.created_at * 1000
                            : v.created_at,
                        ).toLocaleDateString()}
                      </small>
                      <button
                        className={
                          "favorite-button " + (v.favorite ? "active" : "")
                        }
                        aria-label={t(v.favorite ? "unfavorite" : "favorite")}
                        aria-pressed={!!v.favorite}
                        onClick={async () => {
                          try {
                            const next = await api<Version>(
                              "/versions/" + v.id + "/favorite",
                              {
                                method: "PATCH",
                                body: JSON.stringify({ favorite: !v.favorite }),
                              },
                            );
                            setWorks(
                              all.map((x) =>
                                x.id === v.id
                                  ? {
                                      ...x,
                                      ...next,
                                      favorite: next.favorite ?? !v.favorite,
                                    }
                                  : x,
                              ),
                            );
                          } catch (e) {
                            error(e);
                          }
                        }}
                      >
                        <Bookmark size={17} />
                      </button>
                    </div>
                    <Link to={"/versions/" + v.id}>
                      <h3>{v.title}</h3>
                      <p>{v.caption}</p>
                      <span className="work-open">
                        {t("open")}
                        <ArrowUpRight size={16} />
                      </span>
                    </Link>
                    <Link
                      className="text-button work-growth"
                      to={
                        "/worlds/" +
                        v.story_world_id +
                        "?version=" +
                        encodeURIComponent(v.id)
                      }
                    >
                      <GitBranch size={15} />
                      {t("viewWorld")}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>{t("noMatches")}</h2>
            </div>
          )}
        </>
      )}
    </main>
  );
}
function Remix() {
  const { v, err } = useVersion();
  const { t, locale, navigate, error, config, user, setAuth, setNotice } =
    useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [params, setParams] = useSearchParams();
  const selected = params.get("version") || v?.id || "";
  const setSelected = (id: string) =>
    setParams(
      (p) => {
        p.set("version", id);
        return p;
      },
      { replace: true },
    );
  useEffect(() => {
    if (v) {
      api("/story-worlds/" + v.story_world_id)
        .then((r) =>
          setVersions(
            [...r.items].sort((a: Version, b: Version) => a.depth - b.depth),
          ),
        )
        .catch(() => setVersions([v]));
    }
  }, [v?.id]);
  if (err) return <Missing />;
  if (!v) return <Loading />;
  const current = versions.find((x) => x.id === selected) || v;
  return (
    <main className="page remix-page">
      <PageTitle title="remixTitle" desc="remixBody" eyebrow="current" />
      <div className="remix-layout">
        <div>
          <VersionVisual t={t} v={current} large />
          <p className="privacy-note">{t("accurateParent")}</p>
        </div>
        <div>
          <h2>{t("chooseMoment")}</h2>
          <p className="section-desc">{t("chooseMomentBody")}</p>
          <VersionStrip
            t={t}
            items={versions.length ? versions : [v]}
            selected={current.id}
            onSelect={setSelected}
          />
          <Link
            className="text-button"
            to={
              "/worlds/" +
              v.story_world_id +
              "?version=" +
              encodeURIComponent(current.id)
            }
          >
            <GitBranch size={16} />
            {t("lineage")}
            <ArrowUpRight size={16} />
          </Link>
          <Link className="text-button" to={"/result/" + current.id}>
            {t("returnSelected")}
          </Link>
          <textarea
            aria-label={t("remixHint")}
            className="dark-textarea"
            maxLength={420}
            placeholder={t("remixHint")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {!current.remix_allowed && (
            <p className="inline-note">{t("remixDisabled")}</p>
          )}
          <Btn
            kind="primary wide"
            disabled={busy || !current.remix_allowed}
            onClick={async () => {
              if (busy) return;
              if (!config?.generation_enabled) {
                setNotice(t("providerOff"));
                return;
              }
              if (!user) {
                setAuth(true);
                return;
              }
              setBusy(true);
              try {
                const j = await api<Job>("/generation-jobs", {
                  method: "POST",
                  headers: { "Idempotency-Key": crypto.randomUUID() },
                  body: JSON.stringify({
                    kind: "continuation",
                    parent_version_id: current.id,
                    text,
                    locale: locale === "zh-CN" ? "zh-CN" : "en",
                  }),
                });
                sessionStorage.setItem("eupra.job", j.id);
                navigate("/jobs/" + j.id);
              } catch (e) {
                error(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Sparkles size={19} />
            {t("push")}
            <ArrowRight size={20} />
          </Btn>
        </div>
      </div>
    </main>
  );
}
function World() {
  const { id } = useParams();
  const { t, user, locale } = useApp();
  const [items, setItems] = useState<Version[] | null>(null);
  const [err, setErr] = useState(false);
  const [references, setReferences] = useState<AncestorReference[]>([]);
  const [params, setParams] = useSearchParams();
  const selected = params.get("version") || "";
  const setSelected = (id: string) =>
    setParams(
      (p) => {
        p.set("version", id);
        return p;
      },
      { replace: true },
    );
  const [tab, setTab] = useState("worldView");
  const [summary, setSummary] = useState<any>(null);
  const [ownedWorlds, setOwnedWorlds] = useState<
    { id: string; title: string; version_count: number }[] | null
  >(null);
  const [worldListFailed, setWorldListFailed] = useState(false);
  useEffect(() => {
    let active = true;
    if (user)
      api("/me/story-worlds")
        .then((r) => {
          if (active) setOwnedWorlds(r.items);
        })
        .catch(() => {
          if (active) setWorldListFailed(true);
        });
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    if (user)
      api("/me/creator-summary")
        .then((r) => {
          if (active) setSummary(r);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    let alive = true;
    setItems(null);
    setErr(false);
    setReferences([]);
    api("/story-worlds/" + id)
      .then((r) => {
        if (!alive) return;
        const sorted = [...r.items].sort(
          (a: Version, b: Version) => a.depth - b.depth,
        );
        setItems(sorted);
        setReferences(r.ancestor_references || []);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  if (err) return <Missing />;
  if (!items) return <Loading />;
  const current =
    items.find((v) => v.id === selected) || items[items.length - 1];
  if (!current) return <Missing />;
  return (
    <main className="page world-page">
      <div className="world-tabs">
        {["creatorView", "worldView"].map((k) => (
          <button
            className={tab === k ? "active" : ""}
            key={k}
            onClick={() => setTab(k)}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {tab === "creatorView" ? (
        <>
          <div className="creator-profile">
            <img
              src={summary?.profile?.avatar_url || asset("orb-mark.svg")}
              alt=""
            />
            <p className="eyebrow">{t("oneCreator")}</p>
            <h1>{summary?.profile?.nickname || user?.email || t("creator")}</h1>
            <p>{t("privateCreator")}</p>
            {summary?.profile?.bio && (
              <p className="creator-bio">{summary.profile.bio}</p>
            )}
            <div className="library-stats">
              <div>
                <strong>{summary?.stats?.versions ?? "—"}</strong>
                <span>{t("allWorks")}</span>
              </div>
              <div>
                <strong>{summary?.stats?.worlds ?? "—"}</strong>
                <span>{t("worldCount")}</span>
              </div>
            </div>
            <Link className="btn wide" to="/works">
              {t("navWorks")}
              <ArrowRight size={18} />
            </Link>
          </div>
          <section
            className="creator-world-list"
            aria-label={t("yourStoryWorlds")}
          >
            <h2>{t("yourStoryWorlds")}</h2>
            {worldListFailed ? (
              <p role="alert">{t("offline")}</p>
            ) : ownedWorlds === null ? (
              <p>{t("working")}</p>
            ) : ownedWorlds.length ? (
              <div>
                {ownedWorlds.map((world) => (
                  <Link
                    key={world.id}
                    to={"/worlds/" + world.id}
                    onClick={() => setTab("worldView")}
                    className={
                      "creator-world-option " +
                      (world.id === id ? "selected" : "")
                    }
                    aria-current={world.id === id ? "page" : undefined}
                  >
                    <GitBranch size={22} />
                    <span>
                      <strong>{world.title}</strong>
                      <small>
                        {world.version_count} · {t("versionsInWorld")}
                      </small>
                    </span>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
              </div>
            ) : (
              <p>{t("empty")}</p>
            )}
          </section>
          <button
            className="world-feature creator-world"
            onClick={() => setTab("worldView")}
          >
            <VersionVisual t={t} v={items[0]} large />
            <span className="world-feature-badge">
              <GitBranch size={15} />
              {t("growingWorld")}
            </span>
          </button>
        </>
      ) : (
        <>
          <div className="world-identity">
            <p className="eyebrow">{t("growingWorld")}</p>
            <h1>{current.title}</h1>
            <p>{current.caption}</p>
            <div className="creator-chip">
              <img src={asset("logo.png")} alt="" />
              <div>
                <small>{t("creator")}</small>
                <strong>
                  {current.creator_id === user?.id
                    ? user?.email || t("creator")
                    : current.creator_id}
                </strong>
              </div>
            </div>
          </div>
          <div className="world-overview">
            <VersionVisual t={t} v={current} large />
            <div className="world-context">
              <span className="eyebrow">
                {t("selectedVersion")} · {items.indexOf(current) + 1}/
                {items.length}
              </span>
              <Link className="btn primary wide" to={"/remix/" + current.id}>
                <Sparkles size={19} />
                {t("push")}
                <ArrowRight size={19} />
              </Link>
              <Link className="text-button" to={"/versions/" + current.id}>
                {t("viewSelected")}
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
          <h2 className="world-section-title">{t("chooseMoment")}</h2>
          <VersionStrip
            t={t}
            items={items}
            selected={current.id}
            onSelect={setSelected}
          />
          <LineageGraph
            versions={items}
            references={references}
            selected={current.id}
            onSelect={setSelected}
            locale={locale}
          />
          <ContributionCards
            versionId={current.id}
            locale={locale}
            currentUserId={user?.id}
          />
          <h2 className="world-section-title">{t("lineage")}</h2>
          <div className="world-timeline">
            {items.map((v, i) => (
              <div
                className={
                  "timeline-node " + (v.id === current.id ? "selected" : "")
                }
                key={v.id}
                style={{ marginLeft: Math.min(v.depth, 3) * 24 }}
              >
                <div className="node-dot" />
                <div className="node-content">
                  <span className="eyebrow">
                    {t(!v.parent_version_id ? "root" : "current")} {i + 1}
                  </span>
                  <h2>{v.title}</h2>
                  <p>{v.caption}</p>
                  {v.parent_version_id && (
                    <small>
                      {t("parent")} · {v.parent_version_id}
                    </small>
                  )}
                  <div>
                    <Btn className="small" onClick={() => setSelected(v.id)}>
                      {t("viewSelected")}
                    </Btn>
                    <Link className="btn primary small" to={"/remix/" + v.id}>
                      {t("push")}
                      <Sparkles size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function VersionLineage({ v }: { v: Version }) {
  const { t, navigate, locale, user } = useApp();
  const [nodes, setNodes] = useState<Version[]>([]);
  const [references, setReferences] = useState<AncestorReference[]>([]);
  useEffect(() => {
    let alive = true;
    setNodes([v]);
    setReferences([]);
    api("/story-worlds/" + v.story_world_id)
      .then((r) => {
        if (!alive) return;
        const all: Version[] = r.items;
        const path: Version[] = [];
        let cursor: Version | undefined = v;
        const seen = new Set<string>();
        while (cursor && !seen.has(cursor.id)) {
          seen.add(cursor.id);
          path.unshift(cursor);
          const parent: string | null = cursor.parent_version_id;
          cursor = all.find((n) => n.id === parent);
        }
        setNodes(path);
        setReferences(
          (r.ancestor_references || []).filter((ref: AncestorReference) =>
            path.some(
              (n) =>
                n.parent_version_id === ref.id || n.root_version_id === ref.id,
            ),
          ),
        );
      })
      .catch(() => {
        if (alive) setNodes([v]);
      });
    return () => {
      alive = false;
    };
  }, [v.id]);
  return (
    <div className="detail-lineage">
      <h3>{t("lineage")}</h3>
      <VersionStrip
        t={t}
        items={nodes}
        selected={v.id}
        onSelect={(id) => navigate("/versions/" + id)}
      />
      <LineageGraph
        versions={nodes}
        references={references}
        selected={v.id}
        onSelect={(id) => navigate("/versions/" + id)}
        locale={locale}
      />
      <ContributionCards
        versionId={v.id}
        locale={locale}
        currentUserId={user?.id}
      />
      <p className="fineprint">{t("accurateParent")}</p>
    </div>
  );
}
