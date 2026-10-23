import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Version } from "./api";
import { LineageGraph, type AncestorReference } from "./LineageGraph";
export function VersionSheet({
  title,
  close,
  children,
  closeLabel = "Close",
}: {
  closeLabel?: string;
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    root.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="version-sheet-backdrop" onClick={close}>
      <div
        className="version-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={root}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const elements = Array.from(
              root.current!.querySelectorAll<HTMLElement>(
                'button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]',
              ),
            );
            const first = elements[0],
              last = elements[elements.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === root.current)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === root.current)
            ) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="btn" aria-label={closeLabel} onClick={close}>
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
type Source = {
  version_id: string;
  kind: string;
  text: string;
  source_url: string | null;
  source_id: string | null;
  parent_version_id: string | null;
  scope: string;
};
export function SourceSheet({
  versionId,
  locale,
  close,
}: {
  versionId: string;
  locale: string;
  close: () => void;
}) {
  const zh = locale === "zh-CN";
  const [data, setData] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    api<Source>(`/versions/${versionId}/source`)
      .then((r) => {
        if (live) setData(r);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [versionId, epoch]);
  return (
    <VersionSheet
      closeLabel={zh ? "关闭" : "Close"}
      title={zh ? "查看原素材" : "View actual source"}
      close={close}
    >
      <p className="privacy-note">
        {zh
          ? "仅本人可见。这是当前版本实际提交的输入，不包含祖先版本的私密素材。"
          : "Private to you. This is the input submitted for this version, not private inputs inherited from ancestors."}
      </p>
      {failed ? (
        <div role="alert">
          <p>
            {zh
              ? "原素材暂不可用，未替换为示例。"
              : "The original input is unavailable. No example has been substituted."}
          </p>
          <button className="btn" onClick={() => setEpoch((x) => x + 1)}>
            {zh ? "重试" : "Retry"}
          </button>
        </div>
      ) : !data ? (
        <p role="status">
          {zh ? "正在读取原素材…" : "Loading original input…"}
        </p>
      ) : (
        <>
          {data.source_url ? (
            <img
              className="source-sheet-image"
              src={data.source_url}
              alt={zh ? "实际上传的原图" : "Actual uploaded source"}
            />
          ) : (
            <p>
              {zh
                ? "此版本未提交原图。"
                : "No source photo was submitted for this version."}
            </p>
          )}
          {data.text ? (
            <p className="source-sheet-text">{data.text}</p>
          ) : (
            <p>
              {zh
                ? "此版本未提交文字输入。"
                : "No text input was submitted for this version."}
            </p>
          )}
        </>
      )}
    </VersionSheet>
  );
}
export function LineageSheet({
  versions,
  references,
  selected,
  onSelect,
  locale,
  close,
}: {
  versions: Version[];
  references: AncestorReference[];
  selected: string;
  onSelect: (id: string) => void;
  locale: string;
  close: () => void;
}) {
  const chain: Version[] = [];
  const seen = new Set<string>();
  let node = versions.find((v) => v.id === selected);
  while (node && !seen.has(node.id)) {
    chain.unshift(node);
    seen.add(node.id);
    node = versions.find((v) => v.id === node!.parent_version_id);
  }
  return (
    <VersionSheet
      closeLabel={locale === "zh-CN" ? "关闭" : "Close"}
      title={locale === "zh-CN" ? "创作者脉络" : "Creator lineage"}
      close={close}
    >
      <LineageGraph
        versions={chain}
        references={references.filter((r) =>
          chain.some((v) => v.parent_version_id === r.id),
        )}
        selected={selected}
        onSelect={(id) => {
          onSelect(id);
          close();
        }}
        locale={locale}
      />
      <ol className="lineage-sheet-list">
        {chain.map((v) => (
          <li key={v.id}>
            <button
              className="btn"
              onClick={() => {
                onSelect(v.id);
                close();
              }}
            >
              {v.title}
            </button>
            <p>{v.creator_id}</p>
          </li>
        ))}
      </ol>
    </VersionSheet>
  );
}
