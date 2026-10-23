import { useState } from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { CreationWorkbench, JobTheater } from "./CreationPanels";
import { api, type Config, type Job } from "./api";
import en from "./locales/en-US.json";
import zh from "./locales/creation-zh-CN.json";
import copy from "./locales/creation-en-US.json";
vi.mock("./api", () => ({ api: vi.fn() }));
const cfg: Config = {
  market: "CN",
  demo: false,
  generation_enabled: true,
  provider: "test",
  features: { community: false, video: false, payments: false },
  upload: {
    max_bytes: 2 * 1048576,
    mime_types: ["image/jpeg", "image/png", "image/webp"],
  },
};
let notice = vi.fn();
let navigate = vi.fn();
function Fixture({
  config = cfg,
  draftId,
}: {
  config?: Config;
  draftId?: string;
}) {
  const [draft, setDraft] = useState<any>({
    mode: "photo",
    text: "",
    file: null,
    preview: "",
    sample: false,
  });
  return (
    <>
      <CreationWorkbench
        draftId={draftId}
        app={{
          locale: "en-US",
          t: (key: keyof typeof en) => en[key],
          draft,
          setDraft,
          config,
          user: { id: "u1" },
          setAuth: vi.fn(),
          setNotice: notice,
          error: vi.fn(),
          navigate,
        }}
      />
      <output data-testid="file-type">{draft.file?.type}</output>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  notice = vi.fn();
  navigate = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["sample"], { type: "image/jpeg" }),
    })),
  );
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/uploads"
      ? { id: "source-1" }
      : { id: "job-1", status: "queued" },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("creation design integration", () => {
  it("has aligned locale keys and an empty illustrated input", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(copy).sort());
    render(<Fixture />);
    expect(screen.queryByAltText("Photo")).toBeNull();
    expect(screen.getByText(copy.uploadTitle)).toBeTruthy();
    expect(screen.getByText(/up to 2 MB/)).toBeTruthy();
    expect(
      screen.getByLabelText(copy.cameraInput).getAttribute("capture"),
    ).toBe("environment");
  });
  it("selects a real source file then uploads and submits its id", async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: copy.cat }));
    await waitFor(() =>
      expect(screen.getByTestId("file-type").textContent).toBe("image/jpeg"),
    );
    expect(screen.getByAltText("Photo").getAttribute("src")).toBe(
      "/assets/example-cat.jpg",
    );
    fireEvent.click(screen.getByRole("button", { name: en.happen }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/jobs/job-1"));
    const calls = vi.mocked(api).mock.calls;
    expect(calls[0][0]).toBe("/uploads");
    expect(JSON.parse(calls[1][1]?.body as string).source_id).toBe("source-1");
  });
  it("enforces configured limits without uploading anything", async () => {
    render(<Fixture />);
    fireEvent.change(screen.getByLabelText(en.choose), {
      target: {
        files: [
          new File([new Uint8Array(3 * 1048576)], "large.png", {
            type: "image/png",
          }),
        ],
      },
    });
    expect(notice).toHaveBeenCalledWith(copy.invalid.replace("{size}", "2"));
    expect(screen.queryByAltText("Photo")).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });
  it("never submits when generation is unavailable", () => {
    render(<Fixture config={{ ...cfg, generation_enabled: false }} />);
    fireEvent.click(screen.getByRole("button", { name: en.happen }));
    expect(notice).toHaveBeenCalledWith(en.providerOff);
    const submit = screen.getByRole("button", { name: en.happen });
    expect(submit.getAttribute("aria-describedby")).toBe(
      "creation-provider-status",
    );
    expect(submit.parentElement?.textContent).toContain(en.providerOff);
    expect(api).not.toHaveBeenCalled();
  });
  it("does not advance theater stages with elapsed time or invent a source", () => {
    vi.useFakeTimers();
    const job: Job = {
      id: "j",
      status: "queued",
      stage: "REQUEST_INTAKE",
      version_id: null,
      error: null,
      demo: false,
    };
    const { container, rerender } = render(
      <JobTheater locale="en-US" job={job} />,
    );
    expect(container.querySelectorAll(".cp-stage-bars .on")).toHaveLength(1);
    vi.advanceTimersByTime(120000);
    expect(container.querySelectorAll(".cp-stage-bars .on")).toHaveLength(1);
    expect(container.querySelector(".cp-theater-source img")).toBeNull();
    rerender(
      <JobTheater
        locale="en-US"
        job={{ ...job, status: "running", stage: "OUTPUT_SAFETY" }}
      />,
    );
    expect(container.querySelectorAll(".cp-stage-bars .on")).toHaveLength(3);
    expect(screen.getByText(copy.review)).toBeTruthy();
    vi.useRealTimers();
  });
  it("restores full private draft text/source and submits without reuploading", async () => {
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/drafts/d1")
        return {
          id: "d1",
          revision: 3,
          text: "Full original thought",
          source_id: "source1",
          source_url: "/api/v1/uploads/source1",
          parent_version_id: null,
        };
      if (path === "/generation-jobs") return { id: "j1" };
      throw Error(path);
    });
    render(<Fixture draftId="d1" />);
    await waitFor(() =>
      expect(
        document.querySelector(".cp-source-preview")?.getAttribute("src"),
      ).toBe("/api/v1/uploads/source1"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Let it happen" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/jobs/j1"));
    expect(vi.mocked(api).mock.calls.some(([p]) => p === "/uploads")).toBe(
      false,
    );
    const body = JSON.parse(
      vi.mocked(api).mock.calls.find(([p]) => p === "/generation-jobs")![1]!
        .body as string,
    );
    expect(body.source_id).toBe("source1");
    expect(body.text).toBe("Full original thought");
  });
  it("explicitly saves a resumed draft with revision checking", async () => {
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === "/drafts/d1" && !options)
        return {
          id: "d1",
          revision: 3,
          text: "Saved thought",
          source_id: null,
        };
      if (path === "/drafts/d1" && options?.method === "PATCH")
        return { id: "d1", revision: 4 };
      throw Error(path);
    });
    render(<Fixture draftId="d1" />);
    await screen.findByDisplayValue("Saved thought");
    fireEvent.click(screen.getByRole("button", { name: "Save private draft" }));
    await waitFor(() =>
      expect(notice).toHaveBeenCalledWith("Private draft saved."),
    );
    const request = vi
      .mocked(api)
      .mock.calls.find(([, o]) => o?.method === "PATCH")![1]!;
    expect(JSON.parse(request.body as string).expected_revision).toBe(3);
  });
});
