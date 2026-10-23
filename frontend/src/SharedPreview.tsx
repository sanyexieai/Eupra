import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import { api, type Job, type Version } from "./api";
import { VersionVisual } from "./VersionExplorer";
import { ShareUnavailable } from "./ExportPanel";
import zh from "./locales/shared-preview-zh-CN.json";
import en from "./locales/shared-preview-en-US.json";
import "./shared-preview.css";
import { rememberSharedParent } from "./sharedJobCapability";
type App = {
  t: (key: any) => string;
  locale: string;
  user: any;
  setAuth: (value: boolean) => void;
  error: (value: unknown) => void;
  navigate: (path: string) => void;
};
export function SharedPreview({
  app,
  token,
  onSharedJob,
}: {
  app: App;
  token: string;
  onSharedJob: (jobId: string, token: string) => void;
}) {
  const { t, locale, user, setAuth, error, navigate } = app;
  const c = (key: keyof typeof zh) => (locale === "zh-CN" ? zh : en)[key];
  const [data, setData] = useState<{ key: string; version: Version } | null>(
    null,
  );
  const [failure, setFailure] = useState<{ key: string; code?: string } | null>(
    null,
  );
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [children, setChildren] = useState<{
    key: string;
    items: Version[];
  } | null>(null);
  const [childrenFailed, setChildrenFailed] = useState(false);
  const [selected, setSelected] = useState("");
  const key = JSON.stringify([token, user?.id, reload]);
  useEffect(() => {
    let active = true;
    setData(null);
    setFailure(null);
    setChildren(null);
    setChildrenFailed(false);
    setSelected("");
    api("/share/" + encodeURIComponent(token))
      .then(async (value) => {
        if (!active) return;
        const version = value.version || value;
        setData({ key, version });
        if (!user) return;
        rememberSharedParent(version.id, token);
        try {
          const owned = await api<{ items: Version[] }>("/me/works");
          if (active) {
            const items = owned.items.filter(
              (v) =>
                v.parent_version_id === version.id && v.creator_id === user.id,
            );
            setChildren({ key, items });
            setSelected(items[0]?.id || "");
          }
        } catch {
          if (active) setChildrenFailed(true);
        }
      })
      .catch((e) => {
        if (active) setFailure({ key, code: e?.code });
      });
    return () => {
      active = false;
    };
  }, [key]);
  if (failure?.key === key)
    return (
      <ShareUnavailable
        locale={locale}
        errorCode={failure.code}
        onRetry={() => setReload((v) => v + 1)}
      />
    );
  const v = data?.key === key ? data.version : null;
  if (!v)
    return (
      <main className="page narrow" role="status">
        {c("loading")}
      </main>
    );
  const items = children?.key === key ? children.items : [];
  const child = items.find((item) => item.id === selected);
  const continueVersion = async () => {
    if (!user) {
      setAuth(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const job = await api<Job>("/generation-jobs", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          kind: "continuation",
          parent_version_id: v.id,
          share_token: token,
          locale: locale === "zh-CN" ? "zh-CN" : "en",
        }),
      });
      onSharedJob(job.id, token);
      sessionStorage.setItem("eupra.job", job.id);
      navigate("/jobs/" + job.id);
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page narrow public-share sp-page">
      <p className="eyebrow">
        <GitBranch size={17} />
        {t("localPreview")}
      </p>
      <VersionVisual t={t} v={v} large />
      <section className="public-participation">
        <p className="inline-note">{t("localPreviewNote")}</p>
        <h2>{c("compareTitle")}</h2>
        <p>{c("compareNote")}</p>
      </section>
      <Link className="text-button" to="/create">
        {c("resumeTask")}
      </Link>
      <section className="sp-comparison" aria-label={c("compareTitle")}>
        <article>
          <h3>{c("original")}</h3>
          <VersionVisual t={t} v={v} />
          <p className="sp-provenance">
            {c("versionId")} · {v.id}
          </p>
          {v.creator_id && (
            <p className="sp-provenance">
              {c("creatorId")} · {v.creator_id}
            </p>
          )}
        </article>
        <article>
          <h3>{c("yours")}</h3>
          {child ? (
            <>
              <VersionVisual t={t} v={child} />
              <p className="sp-provenance">
                {c("parentId")} · {child.parent_version_id}
              </p>
              <p className="sp-provenance">
                {c("versionId")} · {child.id}
              </p>
              <Link className="btn" to={"/result/" + child.id}>
                {c("viewChild")}
              </Link>
              <Link className="btn primary" to={"/share/" + child.id}>
                {c("saveShare")}
              </Link>
              <p className="fineprint">{c("exportNote")}</p>
            </>
          ) : (
            <p className="sp-empty" role="status">
              {!user
                ? c("loginNote")
                : childrenFailed
                  ? c("loadFailed")
                  : children?.key !== key
                    ? c("loading")
                    : c("noChild")}
            </p>
          )}
          {items.length > 1 && (
            <label className="sp-select">
              {c("chooseChild")}
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                aria-label={c("chooseChild")}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {childrenFailed && (
            <button className="btn" onClick={() => setReload((v) => v + 1)}>
              {c("reload")}
            </button>
          )}
        </article>
      </section>
      <div className="sp-sticky">
        <button
          className="btn primary wide"
          disabled={busy || !v.remix_allowed}
          onClick={continueVersion}
        >
          <Sparkles size={19} />
          {t("push")}
          <ArrowRight size={20} />
        </button>
        <p className="fineprint">
          {t(
            !v.remix_allowed
              ? "remixDisabled"
              : user
                ? "accurateParent"
                : "authNeeded",
          )}
        </p>
      </div>
    </main>
  );
}
