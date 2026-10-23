import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  FolderHeart,
  GitBranch,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import { api, type Version } from "./api";
import { DraftLibrary, type SavedDraft } from "./DraftLibrary";
import { VersionVisual } from "./VersionExplorer";
import mainZh from "./locales/zh-CN.json";
import zh from "./locales/works-panel-zh-CN.json";
import en from "./locales/works-panel-en-US.json";
import "./works-panel.css";
type WorksApp = {
  t: (key: keyof typeof mainZh) => string;
  locale: string;
  user: any;
  setAuth: (v: boolean) => void;
  setNotice: (v: string) => void;
  error: (e: unknown) => void;
};
const asset = (name: string) => "/assets/" + name;
export function WorksPanel({ app }: { app: WorksApp }) {
  const w = (key: keyof typeof en) => (app.locale === "zh-CN" ? zh : en)[key];
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
  const filter = [
    "all",
    "originals",
    "remixes",
    "favorites",
    "drafts",
  ].includes(rawFilter)
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
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Version | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setDraftCount(null);
    if (user)
      api<{ items: SavedDraft[] }>("/me/drafts")
        .then((r) => {
          if (active) setDraftCount(r.items.length);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, refresh]);
  const favorite = async (v: Version) => {
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      const next = await api<Version>(
        "/versions/" + encodeURIComponent(v.id) + "/favorite",
        { method: "PATCH", body: JSON.stringify({ favorite: !v.favorite }) },
      );
      setWorks(
        (current) =>
          current?.map((x) => (x.id === v.id ? { ...x, ...next } : x)) || null,
      );
      setSelected((current) =>
        current?.id === v.id ? { ...current, ...next } : current,
      );
    } catch (e) {
      error(e);
    } finally {
      setFavoriteBusy(false);
    }
  };
  const [worlds, setWorlds] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    let active = true;
    setWorlds([]);
    setWorks(null);
    setFailed(false);
    setSelected(null);
    if (user) {
      api<{ items: { id: string; title: string }[] }>("/me/story-worlds")
        .then((r) => {
          if (active) setWorlds(r.items || []);
        })
        .catch(() => {});
      api<{ items: Version[] }>("/me/works")
        .then((r) => {
          if (active) setWorks(r.items);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id, refresh]);
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
      <div className="page-title">
        <p className="eyebrow">
          <Sparkles size={16} />
          {t("navWorks")}
        </p>
        <h1>{t("yourUniverse")}</h1>
        <p>{t("mySubtitle")}</p>
      </div>
      <DraftLibrary
        app={app}
        onWorksChanged={() => setRefresh((v) => v + 1)}
        onDraftsChanged={() => setRefresh((v) => v + 1)}
      />
      {!user ? (
        <div className="empty">
          <FolderHeart />
          <h2>{t("authNeeded")}</h2>
          <button className="btn primary" onClick={() => setAuth(true)}>
            {t("login")}
            <ArrowRight size={18} />
          </button>
        </div>
      ) : !works && !failed ? (
        <div className="loading" role="status">
          <LoaderCircle className="spin" />
        </div>
      ) : failed ? (
        <div className="empty" role="alert">
          <p>{t("offline")}</p>
          <button
            className="btn"
            onClick={() => {
              setFailed(false);
              setRefresh((v) => v + 1);
            }}
          >
            {w("retry")}
          </button>
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
                <span>{t(label as keyof typeof mainZh)}</span>
              </div>
            ))}
          </div>
          {featured && (
            <>
              <Link
                className="world-feature"
                to={
                  "/worlds/" +
                  encodeURIComponent(featured.story_world_id) +
                  "?version=" +
                  encodeURIComponent(featured.id)
                }
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
              <Link
                className="source-meaning"
                to={
                  "/worlds/" +
                  encodeURIComponent(featured.story_world_id) +
                  "?version=" +
                  encodeURIComponent(featured.id)
                }
              >
                <GitBranch />
                <div>
                  <strong>{t("rootKept")}</strong>
                  <small>{t("accurateParent")}</small>
                </div>
              </Link>
            </>
          )}
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
            {["all", "originals", "remixes", "favorites", "drafts"].map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                aria-label={
                  f === "drafts" ? w("drafts") : t(f as keyof typeof mainZh)
                }
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "drafts" ? w("drafts") : t(f as keyof typeof mainZh)}{" "}
                <span className="wp-tab-count">
                  {f === "drafts"
                    ? (draftCount ?? "—")
                    : f === "all"
                      ? all.length
                      : f === "originals"
                        ? roots.length
                        : f === "remixes"
                          ? all.length - roots.length
                          : all.filter((v) => v.favorite).length}
                </span>
              </button>
            ))}
          </div>
          {filter === "drafts" ? (
            <DraftLibrary
              app={app}
              embedded
              query={query}
              sort={sort}
              onDraftsChanged={() => setRefresh((v) => v + 1)}
            />
          ) : filtered.length ? (
            <div className="works-grid">
              {filtered.map((v) => (
                <article className="work-card" key={v.id}>
                  <button
                    onClick={() => setSelected(v)}
                    className="work-image"
                    aria-label={w("details") + ": " + v.title}
                  >
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
                  </button>
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
                        disabled={favoriteBusy}
                        onClick={() => favorite(v)}
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
      {selected && (
        <WorkDrawer
          app={app}
          version={selected}
          onClose={() => setSelected(null)}
          onFavorite={() => favorite(selected)}
          busy={favoriteBusy}
        />
      )}
    </main>
  );
}
function WorkDrawer({
  app,
  version: v,
  onClose,
  onFavorite,
  busy,
}: {
  app: WorksApp;
  version: Version;
  onClose: () => void;
  onFavorite: () => void;
  busy: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const w = (key: keyof typeof en) => (app.locale === "zh-CN" ? zh : en)[key];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),[tabindex="0"]',
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="wp-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="wp-drawer"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-drawer-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="work-drawer-title">{w("details")}</h2>
          <button
            className="icon-btn"
            aria-label={w("close")}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <VersionVisual v={v} t={app.t} />
        <h3>{v.title}</h3>
        <p className="wp-caption">{v.caption}</p>
        <p className="wp-parent">
          {w(v.parent_version_id ? "derived" : "original")}
          {v.parent_version_id && <span>{v.parent_version_id}</span>}
        </p>
        <div className="wp-actions">
          <button
            className="btn"
            disabled={busy}
            aria-pressed={!!v.favorite}
            onClick={onFavorite}
          >
            <Bookmark size={18} />
            {app.t(v.favorite ? "unfavorite" : "favorite")}
          </button>
          <Link className="btn" to={"/share/" + encodeURIComponent(v.id)}>
            {w("share")}
          </Link>
          <Link
            className="btn"
            to={
              "/worlds/" +
              encodeURIComponent(v.story_world_id) +
              "?version=" +
              encodeURIComponent(v.id)
            }
          >
            <GitBranch size={18} />
            {app.t("viewWorld")}
          </Link>
          <Link
            className="btn primary"
            to={
              "/remix/" +
              encodeURIComponent(v.id) +
              "?version=" +
              encodeURIComponent(v.id)
            }
          >
            {app.t("continueStory")}
            <ArrowRight size={18} />
          </Link>
        </div>
        <Link
          className="wp-full-detail"
          to={"/versions/" + encodeURIComponent(v.id)}
        >
          {w("fullDetail")}
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
  );
}
