import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  Shuffle,
  Sparkles,
  Type,
  Upload,
  X,
} from "lucide-react";
import { api, type Job, type Config } from "./api";
import zh from "./locales/creation-zh-CN.json";
import en from "./locales/creation-en-US.json";
import "./creation-panels.css";
type Mode = "photo" | "text" | "mix";
type Draft = {
  mode: Mode;
  text: string;
  file: File | null;
  preview: string;
  sample: boolean;
};
type App = {
  locale: string;
  t: (key: any) => string;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  config: Config | null;
  user: any;
  setAuth: (v: boolean) => void;
  setNotice: (v: string) => void;
  error: (e: unknown) => void;
  navigate: (path: string) => void;
};
type Key = keyof typeof zh;
const samples = [
  { key: "cat", asset: "example-cat.jpg", mime: "image/jpeg" },
  { key: "run", asset: "example-run.svg", mime: "image/png" },
  { key: "space", asset: "example-world.svg", mime: "image/png" },
] as const;
/** Local SVG design samples are rasterized before upload; the API accepts only raster images. */
export async function sampleFile(asset: string, mime: string): Promise<File> {
  const response = await fetch("/assets/" + asset);
  if (!response.ok) throw new Error("Sample unavailable");
  let blob = await response.blob();
  if (asset.endsWith(".svg")) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      const width = image.naturalWidth || 800;
      const height = image.naturalHeight || 1000;
      const scale = Math.min(1, 2048 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("Rasterization failed")),
          "image/png",
        ),
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  return new File([blob], asset.replace(/\.svg$/, ".png"), { type: mime });
}
export function CreationWorkbench({ app }: { app: App }) {
  const {
    t,
    draft,
    setDraft,
    config,
    user,
    setAuth,
    setNotice,
    error,
    navigate,
    locale,
  } = app;
  const c = (key: Key) => (locale === "zh-CN" ? zh : en)[key];
  const [busy, setBusy] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [drag, setDrag] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const sampleRequest = useRef(0);
  useEffect(
    () => () => {
      sampleRequest.current++;
    },
    [],
  );
  const maxBytes = config?.upload?.max_bytes ?? 10485760;
  const mimes = (
    config?.upload?.mime_types?.length
      ? config.upload.mime_types
      : ["image/jpeg", "image/png", "image/webp"]
  ).filter((v) => ["image/jpeg", "image/png", "image/webp"].includes(v));
  const size = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(maxBytes / 1048576);
  const formats = mimes.map((v) => v.split("/")[1].toUpperCase()).join(" / ");
  const validation = c("invalid").replace("{size}", size);
  const replacePreview = (next: Draft) => {
    if (draft.preview.startsWith("blob:") && draft.preview !== next.preview)
      URL.revokeObjectURL(draft.preview);
    setDraft(next);
  };
  const choose = (file: File) => {
    sampleRequest.current++;
    setLoadingSample(false);
    if (!mimes.includes(file.type) || file.size > maxBytes) {
      setNotice(validation);
      return;
    }
    replacePreview({
      ...draft,
      file,
      preview: URL.createObjectURL(file),
      sample: false,
    });
  };
  const selectSample = async (index: number) => {
    const sample = samples[index];
    const request = ++sampleRequest.current;
    setLoadingSample(true);
    try {
      const file = await sampleFile(sample.asset, sample.mime);
      if (request !== sampleRequest.current) return;
      if (!mimes.includes(file.type) || file.size > maxBytes) {
        setNotice(validation);
        return;
      }
      replacePreview({
        ...draft,
        mode: draft.mode === "text" ? "photo" : draft.mode,
        file,
        preview: "/assets/" + sample.asset,
        sample: true,
      });
      setNotice(c("sampleReady"));
    } catch {
      if (request === sampleRequest.current) setNotice(c("sampleFail"));
    } finally {
      if (request === sampleRequest.current) setLoadingSample(false);
    }
  };
  const submit = async () => {
    if (busy || loadingSample) return;
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
      const job = await api<Job>("/generation-jobs", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          kind: "first_twist",
          text: draft.mode === "photo" ? undefined : draft.text,
          source_id,
          locale: locale === "zh-CN" ? "zh-CN" : "en",
        }),
      });
      sessionStorage.setItem("eupra.job", job.id);
      navigate("/jobs/" + job.id);
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  };
  const fileChange = (element: HTMLInputElement) => {
    if (element.files?.[0]) choose(element.files[0]);
    element.value = "";
  };
  return (
    <div className="cp-workbench workbench">
      <section className="cp-input-card">
        <div className="cp-tabs" role="group" aria-label={t("createTitle")}>
          {(["photo", "text", "mix"] as Mode[]).map((mode, i) => (
            <button
              key={mode}
              aria-pressed={mode === draft.mode}
              className={mode === draft.mode ? "active" : ""}
              disabled={loadingSample || busy}
              onClick={() => setDraft({ ...draft, mode })}
            >
              {
                [
                  <ImageIcon size={18} />,
                  <Type size={18} />,
                  <Layers size={18} />,
                ][i]
              }
              {t(mode)}
            </button>
          ))}
        </div>
        {draft.mode !== "text" && (
          <div
            className={
              "cp-upload-well dropzone " +
              (drag ? "drag " : "") +
              (draft.preview ? "has-image " : "") +
              (draft.mode === "mix" ? "mixed" : "")
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (e.dataTransfer.files[0]) choose(e.dataTransfer.files[0]);
            }}
          >
            {draft.preview ? (
              <>
                <img
                  className="cp-source-preview"
                  src={draft.preview}
                  alt={t("photo")}
                />
                <span className="cp-preview-tag">
                  {draft.sample ? c("sampleLabel") : c("imageReady")}
                </span>
                <div className="cp-image-actions">
                  <button onClick={() => picker.current?.click()}>
                    <Upload size={15} />
                    {c("change")}
                  </button>
                  <button
                    aria-label={t("remove")}
                    onClick={() => {
                      sampleRequest.current++;
                      replacePreview({
                        ...draft,
                        file: null,
                        preview: "",
                        sample: false,
                      });
                      setLoadingSample(false);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="cp-mini-world" aria-hidden="true">
                  <i className="cp-spark one">✦</i>
                  <i className="cp-spark two">✧</i>
                  <div className="cp-mini-frame">
                    <div className="cp-mini-sky">
                      <i />
                      <b />
                      <em />
                    </div>
                  </div>
                  <i className="cp-spark three">✦</i>
                </div>
                <h2>{c("uploadTitle")}</h2>
                <p>{c("uploadSubtitle")}</p>
                <div className="cp-file-actions">
                  <button onClick={() => picker.current?.click()}>
                    <Upload size={17} />
                    {t("choose")}
                  </button>
                  <button onClick={() => camera.current?.click()}>
                    <Camera size={17} />
                    {c("camera")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <input
          hidden
          ref={picker}
          type="file"
          aria-label={t("choose")}
          accept={mimes.join(",")}
          onChange={(e) => fileChange(e.currentTarget)}
        />
        <input
          hidden
          ref={camera}
          type="file"
          aria-label={c("cameraInput")}
          capture="environment"
          accept={mimes.join(",")}
          onChange={(e) => fileChange(e.currentTarget)}
        />
        {draft.mode !== "photo" && (
          <div className="cp-text">
            <textarea
              aria-label={t("text")}
              placeholder={t("placeholder")}
              maxLength={420}
              disabled={loadingSample || busy}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
            <span>{draft.text.length}/420</span>
          </div>
        )}
        {draft.mode !== "text" && (
          <div className="cp-file-note">
            <p>
              {c("limit").replace("{formats}", formats).replace("{size}", size)}
            </p>
            <p>{draft.preview ? c("localPreview") : c("cameraHint")}</p>
          </div>
        )}
      </section>
      <section className="cp-samples">
        <div className="cp-sample-heading">
          <div>
            <h2>{c("samplesTitle")}</h2>
            <p>{c("samplesSubtitle")}</p>
          </div>
          <button
            disabled={loadingSample || busy}
            onClick={() => {
              const current = samples.findIndex(
                (s) => draft.preview === "/assets/" + s.asset,
              );
              const offset = 1 + Math.floor(Math.random() * 2);
              selectSample(
                current < 0
                  ? Math.floor(Math.random() * samples.length)
                  : (current + offset) % samples.length,
              );
            }}
          >
            <Shuffle size={17} />
            {c("surprise")}
          </button>
        </div>
        <div className="cp-sample-grid">
          {samples.map((sample, index) => (
            <button
              key={sample.key}
              disabled={loadingSample || busy}
              aria-pressed={
                draft.sample && draft.preview === "/assets/" + sample.asset
              }
              onClick={() => selectSample(index)}
            >
              <img src={"/assets/" + sample.asset} alt="" />
              <span>{c(sample.key)}</span>
              {draft.sample && draft.preview === "/assets/" + sample.asset && (
                <Check size={18} />
              )}
            </button>
          ))}
        </div>
        <p className="cp-sample-label">{c("sampleLabel")}</p>
      </section>
      <div className="cp-create-action">
        {config && !config.generation_enabled && (
          <div className="cp-provider-note" id="creation-provider-status">
            {t("providerOff")}
          </div>
        )}
        <button
          aria-describedby={
            config && !config.generation_enabled
              ? "creation-provider-status"
              : undefined
          }
          disabled={busy || loadingSample}
          onClick={submit}
        >
          {busy || loadingSample ? (
            <LoaderCircle className="spin" size={21} />
          ) : (
            <Sparkles size={21} />
          )}
          <span>{t(busy ? "working" : "happen")}</span>
          <ArrowRight size={22} />
        </button>
        <p>
          <Check size={15} />
          {c("free")}
        </p>
      </div>
    </div>
  );
}
export function JobTheater({
  locale,
  job,
  failed = false,
  sourcePreview = "",
  sourceText = "",
  children,
}: {
  locale: string;
  job: Job | null;
  failed?: boolean;
  sourcePreview?: string;
  sourceText?: string;
  children?: ReactNode;
}) {
  const c = (key: Key) => (locale === "zh-CN" ? zh : en)[key];
  const terminal =
    job && ["succeeded", "failed", "cancelled"].includes(job.status);
  const stage =
    job?.status === "succeeded"
      ? 3
      : job && ["OUTPUT_SAFETY", "FINAL_JUDGE"].includes(job.stage)
        ? 2
        : job?.stage === "PROVIDER_PIPELINE" || job?.status === "running"
          ? 1
          : 0;
  return (
    <section className="cp-job">
      <small>{c("theaterKicker")}</small>
      <h1>
        {c(
          job?.status === "failed"
            ? "failed"
            : job?.status === "cancelled"
              ? "cancelled"
              : "theaterTitle",
        )}
      </h1>
      <p>
        {c(
          job?.status === "cancelled"
            ? "cancelledBody"
            : job?.status === "failed"
              ? "failedBody"
              : job?.status === "succeeded"
                ? "doneBody"
                : "theaterBody",
        )}
      </p>
      <div className={"cp-theater " + (terminal ? "terminal" : "")}>
        <div className="cp-theater-source">
          {sourcePreview ? (
            <img src={sourcePreview} alt="" />
          ) : (
            <Type size={27} />
          )}
          <div>
            <small>
              {c(sourcePreview || sourceText ? "source" : "sourceUnknown")}
            </small>
            <strong>
              {sourceText || c(sourcePreview ? "source" : "sourceUnknown")}
            </strong>
          </div>
          <ArrowRight size={19} />
        </div>
        <div className="cp-theater-orbit orbit-a" />
        <div className="cp-theater-orbit orbit-b" />
        <div className="cp-theater-orbit orbit-c" />
        <i className="cp-floating pane-a" />
        <i className="cp-floating pane-b" />
        <i className="cp-floating pane-c" />
        <img className="cp-theater-logo" src="/assets/logo.png" alt="" />
        <span className="cp-theater-secret">
          {c(
            terminal
              ? job?.status === "succeeded"
                ? "done"
                : "stopped"
              : "hidden",
          )}
        </span>
        <div className="cp-sound-bars" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} />
          ))}
        </div>
      </div>
      <div className="cp-job-progress" role="status">
        <strong>{c("progress")}</strong>
        <div className="cp-stage-bars" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={job && i <= stage && !failed ? "on" : ""}
            />
          ))}
        </div>
        <p>
          {failed
            ? c("network")
            : c(
                job?.status === "failed"
                  ? "failed"
                  : job?.status === "cancelled"
                    ? "cancelled"
                    : stage === 3
                      ? "done"
                      : stage === 2
                        ? "review"
                        : stage === 1
                          ? "processing"
                          : job
                            ? "queued"
                            : "sourceUnknown",
              )}
        </p>
      </div>
      <p className="cp-timing">{c("timing")}</p>
      {children}
    </section>
  );
}
