import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { api, post, type Version } from "./api";
import zh from "./locales/library-tools-zh-CN.json";
import en from "./locales/library-tools-en-US.json";
import "./draft-library.css";
export type SavedDraft = {
  id: string;
  title: string;
  text: string;
  source_id: string | null;
  source_url?: string | null;
  locale: string;
  parent_version_id: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};
type App = {
  locale: string;
  user: any;
  setAuth: (value: boolean) => void;
  setNotice: (value: string) => void;
};
type Item = {
  kind: "draft" | "work";
  id: string;
  title: string;
  caption: string;
  date: number | string;
  image: string | null;
};
export function DraftLibrary({
  app,
  onWorksChanged,
  embedded = false,
  query = "",
  sort = "newest",
  onDraftsChanged,
}: {
  app: App;
  onWorksChanged?: () => void;
  embedded?: boolean;
  query?: string;
  sort?: string;
  onDraftsChanged?: () => void;
}) {
  const t = (key: keyof typeof zh) => (app.locale === "zh-CN" ? zh : en)[key];
  const [expanded, setOpen] = useState(false);
  const open = embedded || expanded;
  const [tab, setTab] = useState<"drafts" | "trash" | "manage">("drafts");
  const [data, setData] = useState<{
    key: string;
    items: Item[] | null;
    failed: boolean;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Item | null>(null);
  const [mutationError, setMutationError] = useState(false);
  // A tab/account change must never relabel the previous resource's actions,
  // even in the first commit before its loading effect has run.
  const resourceKey = JSON.stringify([
    open,
    tab,
    refresh,
    app.user?.id,
    app.locale,
  ]);
  const items = data?.key === resourceKey ? data.items : null;
  const failed = data?.key === resourceKey && data.failed;
  const visibleItems = items
    ?.filter((item) =>
      (item.title + " " + item.caption)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (Number(b.date) - Number(a.date)) * (sort === "oldest" ? -1 : 1),
    );

  useEffect(() => {
    let active = true;
    setConfirm(null);
    setData({ key: resourceKey, items: null, failed: false });
    setMutationError(false);
    if (!open || !app.user) return;
    const draftItem = (v: SavedDraft): Item => ({
      kind: "draft",
      id: v.id,
      title: v.title || t("untitled"),
      caption: v.text,
      date: v.updated_at,
      image: v.source_url || null,
    });
    const workItem = (v: Version): Item => ({
      kind: "work",
      id: v.id,
      title: v.title,
      caption: v.caption,
      date: v.created_at,
      image: v.image_url,
    });
    const load = async () => {
      try {
        let next: Item[];
        if (tab === "trash") {
          const [d, w] = await Promise.all([
            api<{ items: SavedDraft[] }>("/me/drafts?state=trash"),
            api<{ items: Version[] }>("/me/works?state=trash"),
          ]);
          next = [...d.items.map(draftItem), ...w.items.map(workItem)];
        } else if (tab === "drafts") {
          const d = await api<{ items: SavedDraft[] }>("/me/drafts");
          next = d.items.map(draftItem);
        } else {
          const w = await api<{ items: Version[] }>("/me/works");
          next = w.items.map(workItem);
        }
        if (active) setData({ key: resourceKey, items: next, failed: false });
      } catch {
        if (active) setData({ key: resourceKey, items: null, failed: true });
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [open, tab, refresh, app.user?.id, app.locale]);
  const mutate = async (item: Item, restore: boolean) => {
    if (busy) return;
    setBusy(true);
    setMutationError(false);
    const path =
      (item.kind === "draft" ? "/drafts/" : "/versions/") +
      encodeURIComponent(item.id);
    try {
      if (restore) await post(path + "/restore");
      else await api(path, { method: "DELETE" });
      setData((current) =>
        current?.key === resourceKey
          ? {
              ...current,
              items:
                current.items?.filter(
                  (v) => v.kind !== item.kind || v.id !== item.id,
                ) || [],
            }
          : current,
      );
      setConfirm(null);
      app.setNotice(t("saved"));
      if (item.kind === "work") onWorksChanged?.();
      else onDraftsChanged?.();
    } catch {
      setMutationError(true);
      app.setNotice(t("failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="dl-library">
      {!embedded && (
        <button
          className="dl-heading"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <FolderOpen size={21} />
          <span>
            <strong>{t("title")}</strong>
            <small>{t("intro")}</small>
          </span>
          <ChevronDown className={open ? "open" : ""} size={19} />
        </button>
      )}
      {open && (
        <div className="dl-body">
          {!app.user ? (
            <button className="dl-signin" onClick={() => app.setAuth(true)}>
              {t("login")}
              <ArrowRight size={16} />
            </button>
          ) : (
            <>
              {!embedded && (
                <div className="dl-tabs" role="group" aria-label={t("title")}>
                  {(["drafts", "trash", "manage"] as const).map((key) => (
                    <button
                      key={key}
                      disabled={busy}
                      aria-pressed={tab === key}
                      className={tab === key ? "active" : ""}
                      onClick={() => setTab(key)}
                    >
                      {t(key)}
                    </button>
                  ))}
                  <button
                    disabled={busy}
                    className="dl-refresh"
                    aria-label={t("refresh")}
                    onClick={() => setRefresh((v) => v + 1)}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              )}
              {failed ? (
                <div className="dl-empty" role="alert">
                  <p>{t("error")}</p>
                  <button onClick={() => setRefresh((v) => v + 1)}>
                    {t("retry")}
                  </button>
                </div>
              ) : !items ? (
                <p className="dl-loading" role="status">
                  {t("loading")}
                </p>
              ) : !visibleItems?.length ? (
                <div className="dl-empty">
                  <FileText size={28} />
                  <p>
                    {query
                      ? t("noMatches")
                      : t(
                          tab === "drafts"
                            ? "emptyDrafts"
                            : tab === "trash"
                              ? "emptyTrash"
                              : "emptyWorks",
                        )}
                  </p>
                  {tab === "drafts" && (
                    <Link to="/create">
                      {t("create")}
                      <ArrowRight size={16} />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="dl-items">
                  {visibleItems!.map((item) => (
                    <article className="dl-item" key={item.kind + item.id}>
                      <div className="dl-item-top">
                        <div className="dl-thumb">
                          {item.image ? (
                            <img src={item.image} alt="" />
                          ) : (
                            <FileText size={25} />
                          )}
                        </div>
                        <div>
                          <small>
                            {t(
                              item.kind === "draft" ? "draftType" : "workType",
                            )}
                          </small>
                          <h3>{item.title}</h3>
                          <p>{item.caption}</p>
                          <time>
                            {new Date(
                              typeof item.date === "number"
                                ? item.date * 1000
                                : item.date,
                            ).toLocaleDateString(app.locale)}
                          </time>
                        </div>
                      </div>
                      <div className="dl-actions">
                        {tab === "trash" ? (
                          <button
                            disabled={busy}
                            onClick={() => mutate(item, true)}
                          >
                            <RotateCcw size={15} />
                            {t("restore")}
                          </button>
                        ) : (
                          <>
                            <Link
                              to={
                                item.kind === "draft"
                                  ? "/create?draft=" +
                                    encodeURIComponent(item.id)
                                  : "/versions/" + encodeURIComponent(item.id)
                              }
                            >
                              {t(item.kind === "draft" ? "resume" : "open")}
                              <ArrowRight size={15} />
                            </Link>
                            <button
                              disabled={busy}
                              onClick={() => setConfirm(item)}
                            >
                              <Trash2 size={15} />
                              {t("move")}
                            </button>
                          </>
                        )}
                      </div>
                      {confirm?.id === item.id &&
                        confirm.kind === item.kind && (
                          <div
                            className="dl-confirm"
                            role="group"
                            aria-label={t("confirm")}
                          >
                            <p>
                              {t(
                                item.kind === "draft"
                                  ? "draftConfirm"
                                  : "confirmBody",
                              )}
                            </p>
                            <div>
                              <button
                                disabled={busy}
                                onClick={() => mutate(item, false)}
                              >
                                <Trash2 size={14} />
                                {t("confirm")}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => setConfirm(null)}
                              >
                                <X size={14} />
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        )}
                    </article>
                  ))}
                </div>
              )}
              {mutationError && (
                <div className="dl-error" role="alert">
                  <p>{t("failed")}</p>
                  <button
                    disabled={busy}
                    onClick={() => setRefresh((v) => v + 1)}
                  >
                    {t("refresh")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
