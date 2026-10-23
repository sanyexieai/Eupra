import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Link as LinkIcon,
  Lock,
  Share2,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { api, post, type Config, type Version } from "./api";
import zh from "./locales/export-zh-CN.json";
import en from "./locales/export-en-US.json";
import "./export-panel.css";
type Key = keyof typeof zh;
type App = {
  locale: string;
  t: (key: any) => string;
  user: any;
  config: Config | null;
  setNotice: (v: string) => void;
  error: (e: unknown) => void;
};
const text = (locale: string) => (key: Key) =>
  (locale === "zh-CN" ? zh : en)[key];
export function PosterPreview({
  version,
  locale,
  owned = false,
}: {
  version: Version;
  locale: string;
  owned?: boolean;
}) {
  const c = text(locale);
  return (
    <figure className="ep-poster share-preview" aria-label={c("poster")}>
      <div
        className={"ep-poster-art " + (!version.image_url ? "text-only" : "")}
      >
        {version.image_url ? (
          <img src={version.image_url} alt={version.title} />
        ) : (
          <>
            <img src="/assets/logo.png" alt="" />
            <span>{c("noImage")}</span>
          </>
        )}
        <span className="ep-badge">
          <ShieldCheck size={12} />
          {c(version.demo ? "demo" : "ai")}
        </span>
      </div>
      <figcaption>
        <h2>{version.title}</h2>
        <p>{version.caption}</p>
        <div className="ep-poster-foot">
          <div>
            <small>{owned ? c("byYou") : c("creator")}</small>
            {!owned && <span>{version.creator_id}</span>}
          </div>
          <img src="/assets/logo.png" alt="" />
        </div>
      </figcaption>
    </figure>
  );
}
export function ExportPanel({ app, version }: { app: App; version: Version }) {
  const { t, locale, config, setNotice, error } = app;
  const c = text(locale);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{
    id: string;
    url: string;
    expires_at?: number | string;
  } | null>(null);
  const [revoked, setRevoked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [permission, setPermission] = useState<
    "loading" | "hold" | "unavailable" | "noDelivery"
  >("loading");
  useEffect(() => {
    let active = true;
    setPermission("loading");
    const load = async () => {
      try {
        const response = await api<{ allowed: boolean; reason?: string }>(
          "/versions/" + encodeURIComponent(version.id) + "/export-permission",
        );
        if (active) setPermission(response.allowed ? "noDelivery" : "hold");
      } catch {
        if (active) setPermission("unavailable");
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [version.id]);
  useEffect(() => {
    setReviewed(false);
    setLink(null);
    setRevoked(false);
  }, [version.id]);
  const local =
    !!config?.features.local_review &&
    !!config?.features.share_preview &&
    version.demo &&
    !version.image_url;
  const makeLink = async () => {
    if (busy || !local || !reviewed) return;
    setBusy(true);
    try {
      await post("/versions/" + version.id + "/local-review", {
        approved: true,
      });
      const response = await post("/share-links", { version_id: version.id });
      if (
        typeof response.id !== "string" ||
        typeof response.token !== "string" ||
        !response.token
      ) {
        setNotice(c("linkFailed"));
        return;
      }
      setLink({
        id: response.id,
        url: new URL(
          "/s/" + encodeURIComponent(response.token),
          window.location.origin,
        ).href,
        expires_at: response.expires_at,
      });
      setRevoked(false);
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!link) return;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link.url);
      setNotice(t("copied"));
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice(c("manual"));
    }
  };
  const systemShare = async () => {
    if (!link) return;
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: version.title,
        text: c("scope"),
        url: link.url,
      });
      setNotice(c("sent"));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setNotice(c("shareFailed"));
    }
  };
  let expires = "";
  if (link?.expires_at) {
    const date = new Date(
      typeof link.expires_at === "number"
        ? link.expires_at * 1000
        : link.expires_at,
    );
    if (!Number.isNaN(date.getTime())) expires = date.toLocaleString(locale);
  }
  return (
    <main className="ep-page">
      <div className="ep-topline">
        <Link to={"/versions/" + version.id}>
          <ArrowLeft size={18} />
          {c("back")}
        </Link>
        <span>{t("shareTitle")}</span>
        <span className="ep-top-badge">
          <Share2 size={12} />
          {c("poster")}
        </span>
      </div>
      <section className="ep-surface">
        <div className="ep-poster-stage">
          <PosterPreview
            version={version}
            locale={locale}
            owned={version.creator_id === app.user?.id}
          />
          <small className="ep-dimensions">{c("dimensions")}</small>
        </div>
        <div className="ep-controls">
          <h1>{c("title")}</h1>
          <p className="ep-subtitle">{c("subtitle")}</p>
          <div className="ep-hold inline-note">
            <Lock size={18} />
            <span>{t("shareHold")}</span>
          </div>
          <button
            className="ep-save"
            disabled
            aria-describedby="personal-export-reason"
          >
            <Download size={18} />
            {c("save")}
            <Lock size={14} />
          </button>
          <div className="ep-export-explanation" id="personal-export-reason">
            <strong>{c("exportOff")}</strong>
            <p>{c("exportBody")}</p>
            <p className="ep-permission-status" aria-live="polite">
              {c(
                permission === "loading"
                  ? "permissionLoading"
                  : permission === "hold"
                    ? "permissionHold"
                    : permission === "noDelivery"
                      ? "permissionNoDelivery"
                      : "permissionUnavailable",
              )}
            </p>
          </div>
          {local && (
            <div className="ep-review local-review-panel">
              <h3>{t("localPreview")}</h3>
              <p>{t("localPreviewNote")}</p>
              <label>
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={busy || !!link}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                <span>{t("reviewConfirm")}</span>
              </label>
            </div>
          )}
          <button
            className="ep-link-button"
            disabled={busy || !local || (!reviewed && !link)}
            onClick={link ? copy : makeLink}
          >
            {link ? <Copy size={18} /> : <LinkIcon size={18} />}
            <span>
              {t(link ? "copyLink" : local ? "createPreview" : "makeLink")}
            </span>
            <ArrowRight size={17} />
          </button>
          {link && (
            <section className="ep-live-link">
              <label htmlFor="preview-share-url">{c("link")}</label>
              <input
                id="preview-share-url"
                aria-label={t("localPreview")}
                ref={input}
                className="share-url"
                value={link.url}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
              <p className="ep-scope">
                <ShieldCheck size={15} />
                {c("scope")}
              </p>
              <div className="ep-share-actions">
                <a href={link.url}>
                  {t("openPreview")}
                  <ArrowUpRight size={15} />
                </a>
                <button onClick={systemShare}>
                  <Share2 size={16} />
                  {c("system")}
                </button>
              </div>
              <p className="ep-expiry">
                {expires ? (
                  <>
                    {c("expires")} ·{" "}
                    <time
                      dateTime={new Date(
                        typeof link.expires_at === "number"
                          ? link.expires_at * 1000
                          : link.expires_at!,
                      ).toISOString()}
                    >
                      {expires}
                    </time>
                  </>
                ) : (
                  c("noExpiry")
                )}
              </p>
              <button
                className="ep-revoke"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    await post("/share-links/" + link.id + "/revoke");
                    setLink(null);
                    setReviewed(false);
                    setRevoked(true);
                    setNotice(t("revoked"));
                  } catch (e) {
                    error(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("revokePreview")}
              </button>
              <p className="ep-revoke-note">{c("revokeBody")}</p>
            </section>
          )}
          {revoked && (
            <p className="ep-revoked" role="status">
              <Check size={17} />
              {c("revoked")}
            </p>
          )}
          <Link className="ep-video-link" to={"/video/" + version.id}>
            <span className="ep-video-icon">
              <Video size={20} />
            </span>
            <div>
              <strong>{c("video")}</strong>
              <small>{c("videoBody")}</small>
            </div>
            <ArrowRight size={19} />
          </Link>
          <p className="ep-footer">
            <Sparkles size={15} />
            {c("continue")}
          </p>
        </div>
      </section>
    </main>
  );
}

export function ShareUnavailable({
  locale,
  errorCode,
  onRetry,
}: {
  locale: string;
  errorCode?: string;
  onRetry?: () => void;
}) {
  const c = text(locale);
  const disabled =
    errorCode === "SAFETY_HOLD" || errorCode === "FEATURE_DISABLED";
  return (
    <main className="ep-page ep-unavailable">
      <div className="ep-unavailable-mark">
        <Lock size={30} />
      </div>
      <h1>{c(disabled ? "shareDisabledTitle" : "shareUnavailableTitle")}</h1>
      <p>{c(disabled ? "shareDisabledBody" : "shareUnavailableBody")}</p>
      <div>
        {onRetry && (
          <button className="ep-link-button" onClick={onRetry}>
            {c("retry")}
          </button>
        )}
        <Link className="ep-link-button" to="/create">
          {c("create")}
          <ArrowRight size={17} />
        </Link>
      </div>
    </main>
  );
}
