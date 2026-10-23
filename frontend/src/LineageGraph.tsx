import { useEffect, useState } from "react";
import { GitBranch, Lock, UserRound, RefreshCw } from "lucide-react";
import { api, type Version } from "./api";
import zh from "./locales/lineage-zh-CN.json";
import en from "./locales/lineage-en-US.json";
import "./lineage.css";
export type AncestorReference = {
  id: string;
  access: "private";
  content_available: false;
};
type Node = {
  id: string;
  version?: Version;
  private: boolean;
  x: number;
  y: number;
};
export function graphLayout(
  versions: Version[],
  references: AncestorReference[],
) {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const ids = [
    ...new Set([...references.map((r) => r.id), ...versions.map((v) => v.id)]),
  ];
  const depth = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const parent = byId.get(id)?.parent_version_id;
    return parent && ids.includes(parent) ? depth(parent, seen) + 1 : 0;
  };
  const rows = new Map<number, number>();
  const nodes: Node[] = ids.map((id) => {
    const d = depth(id),
      row = rows.get(d) || 0;
    rows.set(d, row + 1);
    return {
      id,
      version: byId.get(id),
      private: !byId.has(id),
      x: 25 + d * 235,
      y: 30 + row * 125,
    };
  });
  const edges = versions.flatMap((v) =>
    v.parent_version_id && ids.includes(v.parent_version_id)
      ? [{ parent: v.parent_version_id, child: v.id }]
      : [],
  );
  return {
    nodes,
    edges,
    width: Math.max(300, ...nodes.map((n) => n.x + 220)),
    height: Math.max(150, ...nodes.map((n) => n.y + 115)),
  };
}
export function LineageGraph({
  versions,
  references = [],
  selected,
  onSelect,
  locale,
}: {
  versions: Version[];
  references?: AncestorReference[];
  selected: string;
  onSelect: (id: string) => void;
  locale: string;
}) {
  const t = (k: keyof typeof zh) => (locale === "zh-CN" ? zh : en)[k];
  const { nodes, edges, width, height } = graphLayout(versions, references);
  const label = (id: string) =>
    versions.find((v) => v.id === id)?.title ||
    `${t("privateAncestor")} · ${id.slice(0, 8)}`;
  return (
    <section className="lineage-graph" aria-label={t("graphTitle")}>
      <div className="lineage-heading">
        <GitBranch size={19} />
        <h3>{t("graphTitle")}</h3>
      </div>
      <p>{t("graphNote")}</p>
      <p className="lineage-scroll-hint">
        <span aria-hidden="true">↔</span> {t("scrollGraph")}
      </p>
      <div
        className="lineage-scroll"
        tabIndex={0}
        aria-label={t("scrollGraph")}
      >
        <div className="lineage-canvas" style={{ width, height }}>
          <svg width={width} height={height} aria-hidden="true">
            {edges.map((edge) => {
              const p = nodes.find((n) => n.id === edge.parent)!,
                c = nodes.find((n) => n.id === edge.child)!;
              return (
                <path
                  key={edge.child}
                  data-parent={edge.parent}
                  data-child={edge.child}
                  d={`M ${p.x + 190} ${p.y + 43} C ${p.x + 214} ${p.y + 43},${c.x - 24} ${c.y + 43},${c.x} ${c.y + 43}`}
                  fill="none"
                  stroke={edge.child === selected ? "#c2a0ff" : "#686381"}
                  strokeWidth={edge.child === selected ? 2.5 : 1.5}
                />
              );
            })}
          </svg>
          {nodes.map((n) =>
            n.private ? (
              <div
                className="lineage-node private"
                style={{ left: n.x, top: n.y }}
                key={n.id}
              >
                <Lock size={18} />
                <strong>{t("privateAncestor")}</strong>
                <small>
                  {n.id.slice(0, 8)} · {t("contentUnavailable")}
                </small>
              </div>
            ) : (
              <button
                className={
                  "lineage-node " + (n.id === selected ? "selected" : "")
                }
                style={{ left: n.x, top: n.y }}
                key={n.id}
                aria-pressed={n.id === selected}
                onClick={() => onSelect(n.id)}
              >
                {n.version?.image_url ? (
                  <img src={n.version.image_url} alt="" />
                ) : (
                  <GitBranch size={18} />
                )}
                <strong>{n.version!.title}</strong>
                <small>
                  {n.version!.parent_version_id ? t("branch") : t("root")}
                </small>
              </button>
            ),
          )}
        </div>
      </div>
      <ul className="lineage-edge-list">
        {edges.map((e) => (
          <li key={e.child}>
            <span>{label(e.parent)}</span>
            <span aria-hidden="true"> → </span>
            <span className="sr-only">{t("leadsTo")} </span>
            <span>{label(e.child)}</span>
          </li>
        ))}
      </ul>
      {references.length > 0 && (
        <p className="lineage-privacy">
          <Lock size={14} />
          {t("privacyNote")}
        </p>
      )}
    </section>
  );
}
type Contributions = {
  root_creator_id?: string;
  parent_creator_id?: string | null;
  current_creator_id?: string;
  record_available?: boolean;
  revenue_enabled?: boolean;
};
export function ContributionCards({
  versionId,
  locale,
  currentUserId,
}: {
  versionId: string;
  locale: string;
  currentUserId?: string;
}) {
  const t = (k: keyof typeof zh) => (locale === "zh-CN" ? zh : en)[k];
  const [data, setData] = useState<Contributions | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    api<Contributions>("/versions/" + versionId + "/contributions")
      .then((r) => {
        if (alive) setData(r);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [versionId, reload]);
  const roles = [
    ["rootCreator", data?.root_creator_id],
    ["parentCreator", data?.parent_creator_id],
    ["currentCreator", data?.current_creator_id],
  ] as const;
  return (
    <section className="contribution-panel">
      <h3>{t("contributionTitle")}</h3>
      <p>{t("contributionNote")}</p>
      {failed ? (
        <div role="status">
          <p>{t("unavailable")}</p>
          <button
            className="text-button"
            onClick={() => setReload((r) => r + 1)}
          >
            <RefreshCw size={14} />
            {t("retry")}
          </button>
        </div>
      ) : !data ? (
        <p role="status">{t("loading")}</p>
      ) : data.record_available === false || !roles.some(([, id]) => id) ? (
        <p>{t("noRecord")}</p>
      ) : (
        <div className="contribution-cards">
          {roles
            .filter(([, id]) => id)
            .map(([role, id]) => (
              <div key={role}>
                <UserRound size={20} />
                <small>{t(role)}</small>
                <strong>
                  {id === currentUserId ? t("you") : t("creatorId")}
                </strong>
                <code>{id}</code>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
