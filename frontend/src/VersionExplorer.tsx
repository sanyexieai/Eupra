import type { Version } from "./api";
import zh from "./locales/zh-CN.json";
type Translate = (k: keyof typeof zh) => string;
const asset = (name: string) => "/assets/" + name;
export function VersionVisual({
  v,
  large = false,
  t,
}: {
  v: Version;
  large?: boolean;
  t: Translate;
}) {
  return (
    <div className={"version-visual " + (large ? "large" : "")}>
      {v.image_url ? (
        <img src={v.image_url} alt={v.title} />
      ) : (
        <div className="text-concept-visual">
          <img src={asset("logo.png")} alt="" />
        </div>
      )}
      <div className="version-visual-copy">
        <small>
          {t(v.demo ? "textDemo" : v.image_url ? "aiLabel" : "conceptOnly")}
        </small>
        <h2>{v.title}</h2>
        {large && <p>{v.caption}</p>}
      </div>
    </div>
  );
}
export function VersionStrip({
  t,
  items,
  selected,
  onSelect,
}: {
  t: Translate;
  items: Version[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="version-strip"
      role="group"
      aria-label={t("versionBrowser")}
    >
      {items.map((v, i) => (
        <button
          key={v.id}
          className={v.id === selected ? "selected" : ""}
          aria-pressed={v.id === selected}
          onClick={() => onSelect(v.id)}
        >
          <div className="strip-image">
            {v.image_url ? (
              <img src={v.image_url} alt="" />
            ) : (
              <img className="strip-orb" src={asset("orb-mark.svg")} alt="" />
            )}
            <span>
              {!v.parent_version_id
                ? t("root")
                : String(i + 1).padStart(2, "0")}
            </span>
          </div>
          <strong>{v.title}</strong>
          <small>
            {t(v.id === selected ? "selectedVersion" : "viewSelected")}
          </small>
        </button>
      ))}
    </div>
  );
}
