import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExportPanel } from "./ExportPanel";
import { post, type Version, type Config } from "./api";
import en from "./locales/en-US.json";
import copy from "./locales/export-en-US.json";
import zh from "./locales/export-zh-CN.json";
vi.mock("./api", () => ({ post: vi.fn() }));
const version: Version = {
  id: "v1",
  root_version_id: "v1",
  parent_version_id: null,
  story_world_id: "w",
  creator_id: "u1",
  title: "My exact title",
  caption: "My actual returned caption",
  image_url: null,
  source_id: null,
  depth: 0,
  remix_allowed: true,
  safety_state: "HOLD",
  demo: true,
  created_at: 1,
};
const config: Config = {
  market: "CN",
  demo: true,
  generation_enabled: true,
  provider: "demo",
  features: {
    community: false,
    video: false,
    payments: false,
    local_review: true,
    share_preview: true,
  },
  upload: { max_bytes: 10, mime_types: [] },
};
const app = () => ({
  locale: "en-US",
  t: (key: keyof typeof en) => en[key],
  user: { id: "u1" },
  config,
  setNotice: vi.fn(),
  error: vi.fn(),
});
function mount(a = app(), v = version) {
  render(
    <MemoryRouter>
      <ExportPanel app={a} version={v} />
    </MemoryRouter>,
  );
  return a;
}
async function create() {
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: en.createPreview }));
  await screen.findByRole("link", { name: en.openPreview });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(post).mockImplementation(async (path) =>
    path === "/share-links"
      ? { id: "link1", token: "verified-token", expires_at: 1800000000 }
      : { approved: true },
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});
afterEach(cleanup);
describe("poster preview and share boundaries", () => {
  it("describes the unconfigured production gate without inventing a pending review", () => {
    mount();
    expect(screen.getByText(en.shareHold).textContent).toContain(
      "not configured",
    );
    expect(screen.getByText(en.shareHold).textContent).toContain(
      "no moderation job is running",
    );
    expect(en.hold).not.toContain("pending");
  });
  it("keeps locales aligned and all personal export disabled", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(copy).sort());
    mount();
    expect(
      (screen.getByRole("button", { name: copy.save }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(version.title)).toBeTruthy();
    expect(screen.getByText(copy.byYou)).toBeTruthy();
    expect(screen.getByText(copy.dimensions)).toBeTruthy();
  });
  it("does not infer backend review from the checkbox", async () => {
    const a = mount();
    vi.mocked(post).mockRejectedValue(Error("review rejected"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: en.createPreview }));
    await waitFor(() => expect(a.error).toHaveBeenCalled());
    expect(vi.mocked(post).mock.calls).toHaveLength(1);
    expect(screen.queryByRole("link", { name: en.openPreview })).toBeNull();
  });
  it("uses the server link/expiry and revokes only on confirmed success", async () => {
    mount();
    await create();
    expect(
      screen.getByRole("link", { name: en.openPreview }).getAttribute("href"),
    ).toContain("/s/verified-token");
    expect(document.querySelector("time")?.dateTime).toBe(
      new Date(1800000000000).toISOString(),
    );
    expect(
      (screen.getByRole("button", { name: copy.save }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: en.revokePreview }));
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: en.openPreview })).toBeNull(),
    );
    expect(screen.getByRole("status").textContent).toContain(copy.revoked);
  });
  it("reports clipboard failure truthfully and keeps manual copy available", async () => {
    const a = mount();
    await create();
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(Error("denied"));
    fireEvent.click(screen.getByRole("button", { name: en.copyLink }));
    await waitFor(() => expect(a.setNotice).toHaveBeenCalledWith(copy.manual));
    expect(a.setNotice).not.toHaveBeenCalledWith(en.copied);
    expect(screen.getByRole("textbox").getAttribute("value")).toContain(
      "verified-token",
    );
  });
  it("invokes system share only on click and treats user cancellation as cancellation", async () => {
    const a = mount();
    await create();
    expect(navigator.share).not.toHaveBeenCalled();
    const abort = new Error("Cancelled");
    abort.name = "AbortError";
    vi.mocked(navigator.share).mockRejectedValue(abort);
    fireEvent.click(screen.getByRole("button", { name: copy.system }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(a.setNotice).not.toHaveBeenCalledWith(copy.sent);
  });
  it("renders actual image but cannot share or export a held real output", () => {
    mount(app(), { ...version, demo: false, image_url: "/real-owned.png" });
    expect(screen.getByAltText(version.title).getAttribute("src")).toBe(
      "/real-owned.png",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      (screen.getByRole("button", { name: en.makeLink }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });
});
